// supabase/functions/backfill-normalized-url/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRACKING_PARAMS = new Set([
  "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
  "fbclid","gclid","gbraid","wbraid","mc_cid","mc_eid",
  "ref","ref_src","cmpid","mkt_tok","pk_campaign","pk_kwd","pk_source","pk_medium","pk_content",
]);

function normalizeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    // strip tracking params
    for (const p of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(p.toLowerCase())) u.searchParams.delete(p);
    }
    // sort remaining params for stability
    u.searchParams.sort();

    // normalize host casing and trailing slash
    const core = `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    const full = (qs ? `${core}?${qs}` : core).toLowerCase();

    return full.endsWith("?") ? full.slice(0, -1) : full;
  } catch {
    // fallback
    return url.replace(/\/+$/, "").trim().toLowerCase();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let batchSize = 500;
  let maxBatches = 20; // 20 * 500 = 10k rows per run
  try {
    const body = await req.json();
    if (typeof body.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 50), 2000);
    if (typeof body.max_batches === "number") maxBatches = Math.min(Math.max(body.max_batches, 1), 200);
  } catch {
    // no body is fine
  }

  let updated = 0;
  let scanned = 0;
  const startedAt = Date.now();

  console.log(`Starting backfill with batch_size=${batchSize}, max_batches=${maxBatches}`);

  for (let b = 0; b < maxBatches; b++) {
    // fetch next batch needing backfill
    const { data: rows, error } = await supabase
      .from("content_queue")
      .select("id, original_url")
      .is("normalized_url", null)
      .not("original_url", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("Fetch error:", error.message);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rows || rows.length === 0) {
      console.log(`Batch ${b + 1}: No more rows to process`);
      break;
    }

    console.log(`Batch ${b + 1}: Processing ${rows.length} rows`);
    scanned += rows.length;

    // build updates
    const updates = rows
      .map((r) => {
        const n = normalizeUrl(r.original_url || "");
        return n ? { id: r.id, normalized_url: n } : null;
      })
      .filter(Boolean) as Array<{ id: string; normalized_url: string }>;

    // apply updates one by one (safe approach)
    for (const update of updates) {
      const { error: upErr } = await supabase
        .from("content_queue")
        .update({ normalized_url: update.normalized_url })
        .eq("id", update.id);
      if (upErr) {
        console.error("Update error for id", update.id, ":", upErr.message);
        // Continue with other updates, don't fail entire batch
        continue;
      }
      updated++;
    }

    console.log(`Batch ${b + 1}: Updated ${updates.length} rows`);
  }

  console.log(`Backfill complete: scanned=${scanned}, updated=${updated}, duration=${Date.now() - startedAt}ms`);

  return new Response(
    JSON.stringify({
      success: true,
      scanned,
      updated,
      duration_ms: Date.now() - startedAt,
      batch_size: batchSize,
      max_batches: maxBatches,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
