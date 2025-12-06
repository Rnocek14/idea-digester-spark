import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIER1_KEYWORDS = [
  "lake geneva",
  "geneva lake",
  "williams bay",
  "fontana",
  "downtown lake geneva",
  "riviera",
  "big foot beach",
  "nws milwaukee", // NWS alerts for our zone
  "sullivan wi", // NWS station covers Lake Geneva
];

const TIER2_KEYWORDS = [
  "walworth county",
  "walworth",
  "delavan",
  "elkhorn",
  "darien",
  "bloomfield",
  "linn",
  "south central wisconsin", // NWS regional zone
];

type Locality = { tier: 0 | 1 | 2; label: string | null };

function detectLocality(title: string, summary?: string): Locality {
  const text = `${title} ${summary || ""}`.toLowerCase();

  for (const k of TIER1_KEYWORDS) {
    if (text.includes(k)) {
      return { tier: 1, label: "Lake Geneva" };
    }
  }

  for (const k of TIER2_KEYWORDS) {
    if (text.includes(k)) {
      return { tier: 2, label: "Walworth County" };
    }
  }

  return { tier: 0, label: null };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { force = false, batchSize = 500 } = (await req.json().catch(() => ({}))) as {
      force?: boolean;
      batchSize?: number;
    };

    console.log(`🔄 Starting geo tier backfill (force=${force}, batchSize=${batchSize})`);

    // Get source defaults
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("id, name, default_geo_tier");

    if (sourcesError) throw sourcesError;

    const sourceMap = new Map<string, number>();
    (sources || []).forEach((s: any) => {
      sourceMap.set(s.id, s.default_geo_tier ?? 0);
    });

    let processed = 0;
    let updated = 0;
    let lastId: string | null = null;

    while (true) {
      let query = supabase
        .from("content_queue")
        .select("id, source_id, title, summary, geo_tier, geo_label")
        .order("id", { ascending: true })
        .limit(batchSize);

      // Only process nulls unless forcing
      if (!force) {
        query = query.is("geo_tier", null);
      }
      
      if (lastId !== null) {
        query = query.gt("id", lastId);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      if (!rows || rows.length === 0) break;

      for (const row of rows as any[]) {
        processed++;
        lastId = row.id;

        const srcDefaultTier = sourceMap.get(row.source_id) || 0;
        const locality = detectLocality(row.title || "", row.summary || "");

        const newTier = locality.tier > 0 ? locality.tier : srcDefaultTier;
        const newLabel =
          locality.label ||
          (newTier === 1
            ? "Lake Geneva"
            : newTier === 2
              ? "Walworth County"
              : null);

        // Skip if unchanged
        if (row.geo_tier === newTier && row.geo_label === newLabel) {
          continue;
        }

        const { error: updateError } = await supabase
          .from("content_queue")
          .update({ geo_tier: newTier, geo_label: newLabel })
          .eq("id", row.id);

        if (updateError) {
          console.error(`Failed to update ${row.id}:`, updateError);
          continue;
        }
        updated++;
      }

      console.log(`📊 Processed ${processed} rows, updated ${updated} so far...`);

      if (rows.length < batchSize) break;
    }

    console.log(`✅ Geo tier backfill complete: ${processed} processed, ${updated} updated`);

    return new Response(
      JSON.stringify({ ok: true, processed, updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("backfill-geo-tiers error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
