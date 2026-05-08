// Generic iCal feed adapter.
// Processes every active source with type='ical' (or metadata.format='ical').
// Inserts future-dated events into content_queue with category='events',
// inheriting geo_tier + auto-publish posture from the source row.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ICalEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  url: string | null;
  dtstart: Date | null;
  dtend: Date | null;
  allDay: boolean;
  rrule: string | null;
}

function unfoldICal(raw: string): string[] {
  // RFC 5545: unfold lines that begin with whitespace
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseICalDate(value: string): { date: Date | null; allDay: boolean } {
  // Accepts: 20260512T190000Z, 20260512T190000, 20260512
  const v = value.trim();
  if (/^\d{8}$/.test(v)) {
    const y = +v.slice(0, 4), m = +v.slice(4, 6) - 1, d = +v.slice(6, 8);
    return { date: new Date(Date.UTC(y, m, d)), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { date: null, allDay: false };
  const [, Y, Mo, D, H, Mi, S, Z] = m;
  if (Z) {
    return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)), allDay: false };
  }
  // Floating local time — treat as UTC to avoid double conversion
  return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)), allDay: false };
}

function unescapeICal(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseICal(raw: string): ICalEvent[] {
  const lines = unfoldICal(raw);
  const events: ICalEvent[] = [];
  let cur: Partial<ICalEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { uid: "", summary: "", description: null, location: null, url: null, dtstart: null, dtend: null, allDay: false, rrule: null };
    } else if (line === "END:VEVENT") {
      if (cur && cur.summary && cur.dtstart) events.push(cur as ICalEvent);
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const rawKey = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const key = rawKey.split(";")[0].toUpperCase();
      switch (key) {
        case "UID": cur.uid = value.trim(); break;
        case "SUMMARY": cur.summary = unescapeICal(value).trim(); break;
        case "DESCRIPTION": cur.description = unescapeICal(value).trim(); break;
        case "LOCATION": cur.location = unescapeICal(value).trim(); break;
        case "URL": cur.url = value.trim(); break;
        case "DTSTART": {
          const p = parseICalDate(value);
          cur.dtstart = p.date;
          cur.allDay = p.allDay;
          break;
        }
        case "DTEND": {
          const p = parseICalDate(value);
          cur.dtend = p.date;
          break;
        }
        case "RRULE": cur.rrule = value.trim(); break;
      }
    }
  }
  return events;
}

function normalizeUrl(u: string | null): string | null {
  if (!u) return null;
  return u.split("?")[0].replace(/\/+$/, "").toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("status", "active")
    .or("type.eq.ical,metadata->>format.eq.ical");

  if (srcErr) {
    return new Response(JSON.stringify({ error: srcErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    sources: 0,
    events_parsed: 0,
    events_inserted: 0,
    events_skipped_past: 0,
    events_skipped_dup: 0,
    errors: [] as string[],
  };

  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 120); // next 120 days

  for (const source of sources ?? []) {
    summary.sources++;
    const insertedBefore = summary.events_inserted;
    const nowIso = new Date().toISOString();
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "LakeGenevaHyperlocal/1.0 (+https://citybrief.info)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const events = parseICal(body);
      summary.events_parsed += events.length;

      for (const ev of events) {
        if (!ev.dtstart) continue;
        if (ev.dtstart < now) { summary.events_skipped_past++; continue; }
        if (ev.dtstart > horizon) continue;

        const originalUrl = ev.url || source.url;
        const normalized = normalizeUrl(originalUrl + "#" + ev.uid);

        // dedupe by normalized_url
        const { data: existing } = await supabase
          .from("content_queue")
          .select("id")
          .eq("normalized_url", normalized)
          .maybeSingle();
        if (existing) { summary.events_skipped_dup++; continue; }

        const eventDate = ev.dtstart.toISOString().slice(0, 10);
        const eventTime = ev.allDay ? null : ev.dtstart.toISOString().slice(11, 16);
        const trustLocality = (source as any).trust_locality === true;
        const status = trustLocality ? "auto_published" : "pending";

        const { error: insErr } = await supabase.from("content_queue").insert({
          source_id: source.id,
          title: ev.summary,
          content: ev.description || ev.summary,
          summary: ev.description?.slice(0, 280) || null,
          category: "events",
          original_url: originalUrl,
          normalized_url: normalized,
          status,
          safety_level: "safe",
          source_type: "ical",
          geo_tier: source.default_geo_tier ?? 1,
          event_date: eventDate,
          event_time: eventTime,
          geo_label: ev.location || null,
          publish_date: nowIso,
          metadata: {
            ical_uid: ev.uid,
            location: ev.location,
            recurring: !!ev.rrule,
            rrule: ev.rrule,
            source_name: source.name,
          },
        });
        if (insErr) {
          summary.errors.push(`${source.name}: ${insErr.message}`);
        } else {
          summary.events_inserted++;
        }
      }

      const inserted = summary.events_inserted - insertedBefore;
      const update: Record<string, unknown> = {
        last_fetched_at: nowIso,
        last_successful_fetch_at: nowIso,
        last_items_ingested_count: inserted,
        last_error_code: null,
        last_error_detail: null,
      };
      if (inserted > 0) {
        update.last_nonzero_run_at = nowIso;
        update.consecutive_zero_runs = 0;
        update.health_severity = "ok";
      } else {
        const prev = (source as any).consecutive_zero_runs ?? 0;
        const next = prev + 1;
        update.last_zero_items_at = nowIso;
        update.consecutive_zero_runs = next;
        update.health_severity = next >= 10 ? "critical" : (next >= 4 ? "warn" : "ok");
      }
      await supabase.from("sources").update(update).eq("id", source.id);
    } catch (err: any) {
      summary.errors.push(`${source.name}: ${err.message}`);
      await supabase.from("sources").update({
        last_fetched_at: nowIso,
        last_error_code: "fetch_failed",
        last_error_detail: String(err.message || err).slice(0, 500),
      }).eq("id", source.id);
    }
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});