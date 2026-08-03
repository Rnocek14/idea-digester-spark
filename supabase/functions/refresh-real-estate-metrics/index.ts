// Refresh real_estate_metrics from Zillow's public research data (ZHVI).
//
// WHY: /market-report promises "updated monthly" and LakeGenevaByNumbers puts these
// figures on the homepage — but this table had NO writer anywhere in the codebase. It
// was hand-seeded once from Zillow ZHVI in December 2024 and never touched again, so a
// site whose editorial identity is "we never publish numbers we can't stand behind" was
// serving 19-month-old prices under a "monthly" banner. This function makes the promise
// true, the same way everything else here works: a cron, no human.
//
// SOURCE: Zillow Research publishes the Home Value Index as free public CSVs
// (https://www.zillow.com/research/data/), attribution required — which the pages now
// carry. The zip-level file is wide format: one row per zip, one column per month, all
// US zips (~30k rows, tens of MB). We STREAM it and keep only the zips this table
// already tracks, so memory stays flat regardless of file size.
//
// WHICH ZIPS: whatever zip_codes already exist in real_estate_metrics. That is the
// fleet story in one line — a new city seeds one row per zip it cares about, and this
// function keeps them current forever after. No per-city code.
//
// HONESTY RULES:
// - A new row is inserted ONLY when both median_price (latest month) and yoy_change
//   (vs 12 months prior) are derivable from Zillow's file. No invented values.
// - active_listings is not in the ZHVI file; it carries forward from the zip's most
//   recent row and the carry-forward is counted in the run report. A zip with no prior
//   row is skipped (the column is NOT NULL and fabricating inventory is worse than
//   showing nothing).
// - Inserts (not upserts): consumers read the newest row per zip, and each monthly row
//   quietly accumulates the longitudinal price series this table never had.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Candidate URLs, tried in order. Zillow occasionally renames tiers/smoothing in the
// path; a rename must degrade to "no refresh this month" (keeping last month's row),
// never to a crash or a fabricated number.
export const ZHVI_URLS = [
  "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_month.csv",
];

/** Split one CSV line respecting double quotes ("Chicago-Naperville, IL" stays whole). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export type ZipMetrics = { zip: string; medianPrice: number; yoyChange: number; month: string };

/**
 * Stream the CSV, returning metrics for exactly the requested zips.
 * Reads line-by-line so the ~30k-row national file never lives in memory.
 */
export async function extractZips(
  res: Response,
  wanted: Set<string>,
): Promise<Map<string, ZipMetrics>> {
  const found = new Map<string, ZipMetrics>();
  if (!res.body) return found;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let header: string[] | null = null;
  let latestIdx = -1;
  let priorIdx = -1;
  let zipIdx = -1;
  let latestMonth = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    if (!header) {
      header = splitCsvLine(line);
      zipIdx = header.indexOf("RegionName");
      // Date columns are YYYY-MM-DD; the last one is the newest month.
      const dateIdxs = header
        .map((h, i) => (/^\d{4}-\d{2}-\d{2}$/.test(h) ? i : -1))
        .filter((i) => i >= 0);
      latestIdx = dateIdxs[dateIdxs.length - 1] ?? -1;
      latestMonth = latestIdx >= 0 ? header[latestIdx] : "";
      if (latestIdx >= 0) {
        const latest = new Date(latestMonth);
        const target = new Date(Date.UTC(latest.getUTCFullYear() - 1, latest.getUTCMonth(), 15));
        // Find the date column closest to 12 months before the newest.
        let best = -1, bestGap = Infinity;
        for (const i of dateIdxs) {
          const gap = Math.abs(new Date(header[i]).getTime() - target.getTime());
          if (gap < bestGap) { bestGap = gap; best = i; }
        }
        // Accept only a true year-ago column (within ~45 days) — otherwise no YoY.
        priorIdx = bestGap <= 45 * 86400_000 ? best : -1;
      }
      return;
    }
    if (zipIdx < 0 || latestIdx < 0 || priorIdx < 0) return;
    // Cheap prefilter before the full parse; verified against the parsed zip below.
    let maybe = false;
    for (const z of wanted) if (line.includes(z)) { maybe = true; break; }
    if (!maybe) return;

    const cells = splitCsvLine(line);
    const zip = cells[zipIdx];
    if (!wanted.has(zip) || found.has(zip)) return;
    const latest = parseFloat(cells[latestIdx]);
    const prior = parseFloat(cells[priorIdx]);
    if (!isFinite(latest) || !isFinite(prior) || prior <= 0) return;
    found.set(zip, {
      zip,
      medianPrice: Math.round(latest),
      yoyChange: Math.round(((latest - prior) / prior) * 10000) / 100,
      month: latestMonth,
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      handleLine(buf.slice(0, nl).replace(/\r$/, ""));
      buf = buf.slice(nl + 1);
      if (found.size >= wanted.size && header) { reader.cancel().catch(() => {}); return found; }
    }
    if (done) break;
  }
  if (buf) handleLine(buf);
  return found;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // The zips to refresh are the zips the table already tracks.
  const { data: existing, error: exErr } = await supabase
    .from("real_estate_metrics")
    .select("zip_code, active_listings, fetched_at")
    .order("fetched_at", { ascending: false });

  if (exErr) {
    return new Response(JSON.stringify({ error: "could not read existing metrics", detail: exErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const wanted = new Set<string>();
  const priorListings = new Map<string, number>();
  for (const row of existing ?? []) {
    if (!row.zip_code) continue;
    wanted.add(row.zip_code);
    // Rows are newest-first, so the first value seen per zip is the carry-forward.
    if (!priorListings.has(row.zip_code) && typeof row.active_listings === "number") {
      priorListings.set(row.zip_code, row.active_listings);
    }
  }
  if (wanted.size === 0) {
    return new Response(JSON.stringify({ inserted: 0, note: "no tracked zips — seed one row per zip to start tracking" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let metrics: Map<string, ZipMetrics> | null = null;
  let sourceUrl = "";
  for (const url of ZHVI_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn(`[real-estate] ${url} -> ${res.status}`); continue; }
      metrics = await extractZips(res, wanted);
      sourceUrl = url;
      if (metrics.size > 0) break;
    } catch (e) {
      console.warn(`[real-estate] ${url} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!metrics || metrics.size === 0) {
    // Degrade loudly but harmlessly: last month's rows keep serving.
    console.error("[real-estate] no data extracted — table left untouched");
    return new Response(JSON.stringify({ inserted: 0, error: "zhvi unavailable or zips not found" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let inserted = 0, skippedNoListings = 0;
  const results: Record<string, unknown>[] = [];
  for (const m of metrics.values()) {
    const carry = priorListings.get(m.zip);
    if (carry === undefined) { skippedNoListings++; continue; }
    const { error } = await supabase.from("real_estate_metrics").insert({
      zip_code: m.zip,
      median_price: m.medianPrice,
      yoy_change: m.yoyChange,
      active_listings: carry,
      source: "zillow_zhvi",
      fetched_at: new Date().toISOString(),
    });
    if (error) { console.error(`[real-estate] insert ${m.zip}: ${error.message}`); continue; }
    inserted++;
    results.push({ zip: m.zip, median: m.medianPrice, yoy: m.yoyChange, month: m.month });
  }

  return new Response(
    JSON.stringify({ inserted, skipped_no_prior_listings: skippedNoListings, source: sourceUrl, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
