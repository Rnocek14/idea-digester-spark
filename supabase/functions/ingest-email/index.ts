// ingest-email: the no-VPS ingestion backbone.
//
// Polls a Gmail inbox over HTTPS (no Puppeteer, no n8n, no raw TCP) and routes
// each message into the incident pipeline. This is what finally builds the
// "Nixle backbone" described in docs/nixle-backbone-setup.md, and it replaces
// most of what the Facebook scrapers were providing: in nearly every town the
// fire/police/school alerts that get posted to Facebook ALSO go out by Nixle,
// a government listserv, or a press-release list. Subscribing an address is
// free, works in every city, and cannot be rate-limited or bot-blocked.
//
// Per-city routing: a `sources` row with metadata.email_from = "alerts@..."
// binds a sender to a city. Unknown senders are ignored (never guessed).
//
// Setup (one time): create OAuth creds, authorize the inbox once, store
// GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN as secrets.
// Then subscribe that inbox to Nixle, city listservs, press-release lists,
// and add a `sources` row per sender.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_QUERY = "is:unread -label:brief-processed";
const MAX_MESSAGES_PER_RUN = 25;

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

/** Gmail returns base64url; atob needs standard base64. */
export function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  try {
    const bytes = Uint8Array.from(atob(withPad), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/** Depth-first search for the first text/plain part; falls back to text/html stripped. */
export function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return "";
  const walk = (part: GmailPart, wanted: string): string => {
    if (part.mimeType === wanted && part.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part.parts ?? []) {
      const found = walk(child, wanted);
      if (found) return found;
    }
    return "";
  };
  const plain = walk(payload, "text/plain");
  if (plain) return plain;
  const html = walk(payload, "text/html");
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      // Block-level ends become line breaks; inline tags vanish without
      // inserting spaces (otherwise "the <b>library</b>." -> "the library .").
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return "";
}

export function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** "Walworth Alerts <alerts@nixle.com>" -> "alerts@nixle.com" */
export function parseFromAddress(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  return (angle ? angle[1] : from).trim().toLowerCase();
}

/** Strip listserv/Nixle boilerplate that would otherwise dominate the summary. */
export function cleanAlertBody(body: string): string {
  return body
    .split(/\n?--+\s*\n|\bUnsubscribe\b|\bYou are receiving this\b|\bThis message was sent to\b/i)[0]
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 3500);
}

async function getAccessToken(): Promise<string | null> {
  const client_id = Deno.env.get("GMAIL_CLIENT_ID");
  const client_secret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refresh_token = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!client_id || !client_secret || !refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    console.error("[ingest-email] token refresh failed", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const json = await res.json();
  return json.access_token ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = await getAccessToken();
    if (!accessToken) {
      // Graceful no-op until the inbox is authorized — same pattern as
      // alert-source-health. Never an error the operator has to chase.
      console.log("[ingest-email] Gmail credentials not configured — skipping");
      return respond({ success: true, skipped: "gmail_not_configured" });
    }

    const ingestSecret = Deno.env.get("CIVIC_INGEST_SECRET");
    if (!ingestSecret) return respond({ success: false, error: "CIVIC_INGEST_SECRET not set" }, 500);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Sender -> source binding. Only known senders are ingested; an unknown
    // address is left unread for the operator rather than guessed at.
    const { data: emailSources } = await supabase
      .from("sources")
      .select("id, name, city_id, status, category, metadata")
      .not("metadata->>email_from", "is", null);

    const senderMap = new Map<string, { name: string; city_id: string; source_type: string; category: string }>();
    for (const s of emailSources ?? []) {
      const addr = String(s.metadata?.email_from ?? "").trim().toLowerCase();
      if (!addr || s.status === "inactive") continue;
      senderMap.set(addr, {
        name: s.name,
        city_id: s.city_id ?? "default",
        source_type: String(s.metadata?.email_source_type ?? "email"),
        category: s.category ?? "safety",
      });
    }

    const gmail = async (path: string, init: RequestInit = {}) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      });

    const listRes = await gmail(
      `messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=${MAX_MESSAGES_PER_RUN}`
    );
    if (!listRes.ok) {
      return respond({ success: false, error: `gmail list ${listRes.status}` }, 502);
    }
    const list = await listRes.json();
    const messageIds: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);

    const results = { checked: 0, ingested: 0, unknown_sender: 0, errors: [] as string[] };

    for (const id of messageIds) {
      results.checked++;
      try {
        const msgRes = await gmail(`messages/${id}?format=full`);
        if (!msgRes.ok) throw new Error(`gmail get ${msgRes.status}`);
        const msg = await msgRes.json();

        const headers: GmailHeader[] = msg.payload?.headers ?? [];
        const fromAddr = parseFromAddress(headerValue(headers, "From"));
        const subject = headerValue(headers, "Subject").trim();
        const dateHeader = headerValue(headers, "Date");

        const source = senderMap.get(fromAddr);
        if (!source) {
          results.unknown_sender++;
          continue; // left unread on purpose — operator decides if it's worth a source row
        }

        const body = cleanAlertBody(extractBody(msg.payload));
        if (!subject && !body) throw new Error("empty message");

        // Route through ingest-incident so the Tier-4/Tier-3 editorial gates,
        // geo gates, dedupe, and confidence scoring all apply — email gets no
        // special privileges over any other source.
        const started_at = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
        const ingestRes = await fetch(`${supabaseUrl}/functions/v1/ingest-incident`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ingest-secret": ingestSecret },
          body: JSON.stringify({
            source: source.name,
            source_type: source.source_type,
            external_id: `gmail-${id}`,
            title: (subject || body.slice(0, 120)).slice(0, 280),
            body: body.slice(0, 4000),
            started_at: isNaN(Date.parse(started_at)) ? new Date().toISOString() : started_at,
            raw: { gmail_id: id, from: fromAddr, city_id: source.city_id },
          }),
        });
        if (!ingestRes.ok) throw new Error(`ingest-incident ${ingestRes.status}`);
        results.ingested++;

        // Mark processed so it is never re-ingested (dedupe also guards this).
        await gmail(`messages/${id}/modify`, {
          method: "POST",
          body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
        });
      } catch (e) {
        results.errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (results.ingested > 0 || results.errors.length > 0) {
      await supabase.from("activity_log").insert({
        actor_type: "system",
        entity_type: "source",
        action: "ingest_email",
        message: `Email ingest: ${results.ingested} ingested, ${results.unknown_sender} unknown senders, ${results.errors.length} errors`,
        details: results,
      });
    }

    console.log("[ingest-email] Completed:", results);
    return respond({ success: true, ...results });
  } catch (error) {
    console.error("[ingest-email] Error:", error);
    return respond(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
