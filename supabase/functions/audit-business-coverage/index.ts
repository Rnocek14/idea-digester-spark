import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Total counts by geo_tier
    const { data: tierCounts } = await supabase
      .from("business_profiles")
      .select("geo_tier")
      .not("is_hidden", "eq", true);

    const byGeoTier = {
      core: tierCounts?.filter((r) => r.geo_tier === 1).length || 0,
      adjacent: tierCounts?.filter((r) => r.geo_tier === 2).length || 0,
      unknown: tierCounts?.filter((r) => !r.geo_tier).length || 0,
    };

    // Counts by business_type
    const { data: typeCounts } = await supabase
      .from("business_profiles")
      .select("business_type")
      .not("is_hidden", "eq", true);

    const byBusinessType: Record<string, number> = {};
    for (const row of typeCounts || []) {
      const type = row.business_type || "unknown";
      byBusinessType[type] = (byBusinessType[type] || 0) + 1;
    }

    // Missing fields
    const { count: missingWebsite } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .is("website", null)
      .not("is_hidden", "eq", true);

    const { count: missingPhone } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .is("phone", null)
      .not("is_hidden", "eq", true);

    const { count: missingAddress } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .is("address", null)
      .not("is_hidden", "eq", true);

    const { count: missingCity } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .is("city", null)
      .not("is_hidden", "eq", true);

    const { count: missingPlaceId } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .is("google_place_id", null)
      .not("is_hidden", "eq", true);

    // Source confidence breakdown
    const { data: confidenceCounts } = await supabase
      .from("business_profiles")
      .select("source_confidence")
      .not("is_hidden", "eq", true);

    const byConfidence: Record<string, number> = {};
    for (const row of confidenceCounts || []) {
      const conf = row.source_confidence || "unknown";
      byConfidence[conf] = (byConfidence[conf] || 0) + 1;
    }

    // Import source breakdown
    const { data: importSourceCounts } = await supabase
      .from("business_profiles")
      .select("import_source")
      .not("is_hidden", "eq", true);

    const byImportSource: Record<string, number> = {};
    for (const row of importSourceCounts || []) {
      const source = row.import_source || "manual";
      byImportSource[source] = (byImportSource[source] || 0) + 1;
    }

    // Restaurant linkage audit
    const { count: totalRestaurants } = await supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true });

    const { count: linkedRestaurants } = await supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .not("business_profile_id", "is", null);

    // Hidden/excluded businesses
    const { count: hiddenCount } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_hidden", true);

    // Closed businesses
    const { count: closedCount } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "closed");

    // Total active
    const { count: totalActive } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .not("is_hidden", "eq", true);

    // Potential duplicates (same normalized_name, different id)
    const { data: potentialDupes } = await supabase
      .from("business_profiles")
      .select("normalized_name, name, id, address")
      .not("normalized_name", "is", null)
      .not("is_hidden", "eq", true);

    const nameGroups: Record<string, Array<{ id: string; name: string; address: string | null }>> = {};
    for (const row of potentialDupes || []) {
      if (!nameGroups[row.normalized_name]) {
        nameGroups[row.normalized_name] = [];
      }
      nameGroups[row.normalized_name].push({
        id: row.id,
        name: row.name,
        address: row.address,
      });
    }

    const duplicateSuspects = Object.entries(nameGroups)
      .filter(([, items]) => items.length > 1)
      .map(([normalized, items]) => ({
        normalized_name: normalized,
        count: items.length,
        items,
      }))
      .slice(0, 10); // Top 10 only

    const total = (tierCounts?.length || 0);
    const missingWebsitePct = total > 0 ? ((missingWebsite || 0) / total * 100).toFixed(1) : "0";
    const missingPhonePct = total > 0 ? ((missingPhone || 0) / total * 100).toFixed(1) : "0";

    return new Response(
      JSON.stringify({
        success: true,
        audit: {
          total_businesses: total,
          total_active: totalActive,
          by_geo_tier: byGeoTier,
          by_business_type: byBusinessType,
          by_source_confidence: byConfidence,
          by_import_source: byImportSource,
          missing_fields: {
            website: { count: missingWebsite, percent: missingWebsitePct },
            phone: { count: missingPhone, percent: missingPhonePct },
            address: missingAddress,
            city: missingCity,
            google_place_id: missingPlaceId,
          },
          restaurant_linkage: {
            total_restaurants: totalRestaurants,
            linked_to_profile: linkedRestaurants,
            unlinked: (totalRestaurants || 0) - (linkedRestaurants || 0),
          },
          hidden_businesses: hiddenCount,
          closed_businesses: closedCount,
          duplicate_suspects: duplicateSuspects,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Audit error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
