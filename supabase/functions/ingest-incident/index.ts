// ingest-incident: single endpoint for Apify (Facebook), Nixle (email/SMS),
// future RSS/webhook/email/community_tip sources. Applies deterministic
// tier-based editorial gates, multi-source confidence boost, and optional
// AI rewrite for Tier 2 content.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Geo gate values (bbox + gazetteer) come from city_config — see _shared/cityConfig.ts.
import {
  getCityConfig,
  withinBbox as bboxContains,
  hasLocalKeyword as configHasLocalKeyword,
} from "../_shared/cityConfig.ts";

// Tier 4 (auto-reject) and Tier 3 (hold) keyword lists live in the shared
// incident gate so cron scrapers apply the same filters as this tier engine.
import { TIER_4_REJECT, TIER_3_HOLD } from "../_shared/incidentGate.ts";

// --- Tier 2: AI rewrite then publish. Routine emergency response, non-critical. ---
const TIER_2_REWRITE = [
  "fire response", "kitchen fire", "small fire", "brush fire",
  "boat incident", "boat fire", "water rescue", "vehicle fire",
  "accident", "crash", "fender bender", "minor injury", "no injuries",
  "structure fire", "alarm activation",
];

// --- Tier 1: publish as-is. Civic / community / infrastructure. ---
const TIER_1_AUTO = [
  "road closed", "road closure", "lane closed", "detour", "construction",
  "power outage", "outage", "atc restored", "we energies",
  "weather alert", "tornado", "thunderstorm warning", "flood",
  "winter storm", "wind advisory", "heat advisory",
  "water main", "boil order", "water advisory",
  "school closing", "school closed", "early dismissal", "delayed start",
  "event cancel", "event postpon", "parade", "fireworks",
  "tree down", "tree blocking", "traffic", "back up", "stopped traffic",
];

// --- Confidence baseline by source_type ---
const CONFIDENCE_BASELINE: Record<string, number> = {
  official: 95,    // city / county / sheriff / fire dept direct
  nixle: 95,
  webhook: 90,
  rss: 80,
  email: 75,
  facebook: 70,    // apify scrape of public scanner / fire pages
  apify: 70,
  community_tip: 30,
  manual: 80,
};


function matchAny(haystack: string, needles: string[]): string | null {
  const h = haystack.toLowerCase();
  for (const n of needles) {
    if (h.includes(n)) return n;
  }
  return null;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) + "-" + Math.random().toString(36).slice(2, 7);
}

const PayloadSchema = z.object({
  source: z.string().min(1).max(120),
  source_type: z.enum([
    "facebook", "rss", "email", "webhook", "official",
    "manual", "community_tip", "nixle", "apify",
  ]).default("manual"),
  external_id: z.string().min(1).max(255),
  title: z.string().min(3).max(280),
  body: z.string().max(4000).optional().default(""),
  location: z.string().max(255).optional(),
  incident_type: z.string().max(60).optional().default("other"),
  started_at: z.string().datetime().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  raw: z.record(z.unknown()).optional(),
});
type Payload = z.infer<typeof PayloadSchema>;

// Multi-source verification: if a similar active incident exists within 60min,
// link this observation and boost confidence by +20.
async function findSimilarIncident(
  supabase: ReturnType<typeof createClient>,
  p: Payload,
): Promise<{ id: string; current_confidence: number } | null> {
  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // Try by lat/lon proximity (~0.5 mi ≈ 0.007 deg) first.
  if (typeof p.lat === "number" && typeof p.lon === "number") {
    const { data } = await supabase
      .from("incidents")
      .select("id, confidence_score, lat, lon")
      .gte("started_at", sixtyMinAgo)
      .in("status", ["active", "developing", "monitoring", "pending_review"])
      .not("lat", "is", null)
      .limit(20);
    const near = (data || []).find((row) => {
      if (typeof row.lat !== "number" || typeof row.lon !== "number") return false;
      return Math.abs(row.lat - p.lat!) < 0.007 && Math.abs(row.lon - p.lon!) < 0.007;
    });
    if (near) return { id: near.id, current_confidence: near.confidence_score ?? 50 };
  }
  // Fall back to title token overlap on the same location string.
  if (p.location) {
    const { data } = await supabase
      .from("incidents")
      .select("id, confidence_score, location, title")
      .gte("started_at", sixtyMinAgo)
      .in("status", ["active", "developing", "monitoring", "pending_review"])
      .ilike("location", `%${p.location.slice(0, 40)}%`)
      .limit(5);
    if (data && data[0]) {
      return { id: data[0].id, current_confidence: data[0].confidence_score ?? 50 };
    }
  }
  return null;
}

async function aiRewrite(text: string, location?: string): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a hyperlocal newsroom editor for Lake Geneva, WI. Rewrite the incident report in 1-2 sentences in a neighborly tone. Rules: no private citizen names; no speculation; no scanner jargon; state the location and what residents/drivers should expect. Output only the rewritten text, no preamble.",
          },
          {
            role: "user",
            content: `Location: ${location || "unspecified"}\n\nOriginal: ${text}`,
          },
        ],
        max_tokens: 160,
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      console.error("ai rewrite failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const out = json?.choices?.[0]?.message?.content?.trim();
    return typeof out === "string" && out.length > 0 ? out : null;
  } catch (err) {
    console.error("ai rewrite error", err);
    return null;
  }
}

interface TierDecision {
  tier: 1 | 2 | 3 | 4;
  status: "active" | "pending_review" | "rejected";
  hold_reason: string | null;
  matched: string;
}

async function classify(
  supabase: ReturnType<typeof createClient>,
  haystack: string,
): Promise<TierDecision> {
  // Learned reject rules win above all.
  const { data: learned } = await supabase
    .from("incident_reject_rules")
    .select("keyword")
    .limit(500);
  const learnedKw = (learned || []).map((r: { keyword: string }) => r.keyword.toLowerCase());
  const learnedHit = matchAny(haystack, learnedKw);
  if (learnedHit) {
    return { tier: 4, status: "rejected", hold_reason: `learned_rule:${learnedHit}`, matched: learnedHit };
  }
  const t4 = matchAny(haystack, TIER_4_REJECT);
  if (t4) return { tier: 4, status: "rejected", hold_reason: `tier4:${t4}`, matched: t4 };
  const t3 = matchAny(haystack, TIER_3_HOLD);
  if (t3) return { tier: 3, status: "pending_review", hold_reason: `tier3:${t3}`, matched: t3 };
  const t2 = matchAny(haystack, TIER_2_REWRITE);
  if (t2) return { tier: 2, status: "active", hold_reason: null, matched: t2 };
  const t1 = matchAny(haystack, TIER_1_AUTO);
  if (t1) return { tier: 1, status: "active", hold_reason: null, matched: t1 };
  // Default: unclassified low-signal content goes to hold queue.
  return { tier: 3, status: "pending_review", hold_reason: "unclassified", matched: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: shared secret in Authorization: Bearer <secret> OR x-ingest-secret header.
  const expected = Deno.env.get("CIVIC_INGEST_SECRET");
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-ingest-secret") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const presented = headerSecret || bearer;
  if (!expected || presented !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Accept either a single payload or { items: [...] }
  const items: unknown[] = Array.isArray((raw as { items?: unknown }).items)
    ? (raw as { items: unknown[] }).items
    : [raw];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cityConfig = await getCityConfig(supabase);
  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const parsed = PayloadSchema.safeParse(item);
    if (!parsed.success) {
      results.push({ ok: false, error: "validation", details: parsed.error.flatten() });
      continue;
    }
    const p = parsed.data;
    const haystack = `${p.title} ${p.body} ${p.location ?? ""}`;

    // Geo gate (skip for trusted official sources — they're pre-filtered by area).
    const trustedGeoSkip = p.source_type === "official" || p.source_type === "nixle";
    if (!trustedGeoSkip && !bboxContains(cityConfig.bbox, p.lat, p.lon) && !configHasLocalKeyword(cityConfig, haystack)) {
      results.push({ ok: false, error: "out_of_geo", source: p.source, external_id: p.external_id });
      continue;
    }

    // Dedupe on (source, external_id)
    const { data: existing } = await supabase
      .from("incidents")
      .select("id")
      .eq("source", p.source)
      .eq("external_id", p.external_id)
      .maybeSingle();
    if (existing) {
      results.push({ ok: true, deduped: true, id: existing.id });
      continue;
    }

    // Tier classification
    const decision = await classify(supabase, haystack);

    // Tier 4 short-circuits: never merge, never boost — just log + drop.
    if (decision.tier === 4) {
      results.push({
        ok: true, rejected: true, tier: 4,
        hold_reason: decision.hold_reason, source: p.source, external_id: p.external_id,
      });
      continue;
    }

    // AI rewrite for Tier 2 only
    let aiText: string | null = null;
    if (decision.tier === 2) {
      aiText = await aiRewrite(p.body || p.title, p.location);
      if (!aiText) {
        // Rewrite failed → fall back to hold queue rather than publishing raw.
        decision.tier = 3;
        decision.status = "pending_review";
        decision.hold_reason = "ai_rewrite_failed";
      }
    }

    // Multi-source verification: link + boost confidence
    const similar = await findSimilarIncident(supabase, p);
    let confidence = CONFIDENCE_BASELINE[p.source_type] ?? 50;
    let linkedTo: string | null = null;
    if (similar) {
      // Don't create duplicate — append observation, boost the existing incident.
      const boosted = Math.min(99, (similar.current_confidence ?? 50) + 20);
      await supabase.from("incidents").update({
        confidence_score: boosted,
        updated_at: new Date().toISOString(),
      }).eq("id", similar.id);
      await supabase.from("incident_source_observations").insert({
        incident_id: similar.id,
        source: p.source,
        source_type: p.source_type,
        external_id: p.external_id,
        raw: p.raw ?? null,
      });
      await supabase.from("incident_updates").insert({
        incident_id: similar.id,
        source: p.source,
        source_label: p.source,
        text: aiText || p.body || p.title,
        is_verified: confidence >= 90,
      });
      linkedTo = similar.id;
      results.push({ ok: true, linked_to: linkedTo, boosted_confidence: boosted });
      continue;
    }

    // Fresh incident insert
    const insertRow = {
      slug: slugify(p.title),
      city_id: cityConfig.id,
      title: p.title,
      body: aiText || p.body || null,
      original_body: p.body || null,
      ai_rewrite: aiText,
      location: p.location || null,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      incident_type: p.incident_type || "other",
      status: decision.status,
      tier: decision.tier,
      hold_reason: decision.hold_reason,
      confidence_score: confidence,
      source: p.source,
      source_type: p.source_type,
      external_id: p.external_id,
      started_at: p.started_at || new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from("incidents")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr) {
      console.error("insert failed", insErr);
      results.push({ ok: false, error: "db_insert", message: insErr.message });
      continue;
    }

    await supabase.from("incident_source_observations").insert({
      incident_id: inserted.id,
      source: p.source,
      source_type: p.source_type,
      external_id: p.external_id,
      raw: p.raw ?? null,
    });

    results.push({
      ok: true,
      id: inserted.id,
      tier: decision.tier,
      status: decision.status,
      confidence,
    });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});