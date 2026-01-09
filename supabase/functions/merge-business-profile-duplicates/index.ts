import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MergeRequest {
  normalized_names?: string[];
  dry_run?: boolean;
  auto_detect?: boolean;
}

interface ProfileRow {
  id: string;
  name: string;
  normalized_name: string | null;
  google_place_id: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  import_source: string | null;
  is_hidden: boolean | null;
}

function scoreProfile(profile: ProfileRow): number {
  let score = 0;
  if (profile.google_place_id) score += 5;
  if (profile.address) score += 3;
  if (profile.import_source === "google_places") score += 2;
  if (profile.phone) score += 1;
  if (profile.website) score += 1;
  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body: MergeRequest = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? true;
    const autoDetect = body.auto_detect ?? true;

    const results = {
      merges: [] as Array<{
        normalized_name: string;
        winner: { id: string; name: string; score: number };
        losers: Array<{ id: string; name: string; score: number }>;
        restaurant_rewires: number;
      }>,
      total_merges: 0,
      total_rewires: 0,
      warnings: [] as string[],
      errors: [] as string[],
    };

    // Get all profiles for duplicate detection
    const { data: allProfiles, error: fetchError } = await supabase
      .from("business_profiles")
      .select("id, name, normalized_name, google_place_id, address, city, phone, website, import_source, is_hidden")
      .eq("is_hidden", false)
      .not("normalized_name", "is", null);

    if (fetchError) {
      throw new Error(`Failed to fetch profiles: ${fetchError.message}`);
    }

    // Group by normalized_name
    const groups: Record<string, ProfileRow[]> = {};
    for (const profile of allProfiles || []) {
      const key = profile.normalized_name!;
      if (!groups[key]) groups[key] = [];
      groups[key].push(profile);
    }

    // Filter to only duplicates
    let targetNames: string[];
    if (body.normalized_names && body.normalized_names.length > 0) {
      targetNames = body.normalized_names;
    } else if (autoDetect) {
      targetNames = Object.keys(groups).filter((k) => groups[k].length > 1);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "No normalized_names provided and auto_detect is false" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${targetNames.length} duplicate groups`);

    for (const normalizedName of targetNames) {
      const group = groups[normalizedName];
      if (!group || group.length < 2) {
        results.warnings.push(`No duplicates found for: ${normalizedName}`);
        continue;
      }

      // Score each profile
      const scored = group.map((p) => ({ ...p, score: scoreProfile(p) }));
      scored.sort((a, b) => b.score - a.score);

      const winner = scored[0];
      const losers = scored.slice(1);

      // Safety check: if winner and any loser have DIFFERENT non-null addresses, warn
      for (const loser of losers) {
        if (winner.address && loser.address && winner.address !== loser.address) {
          // Check if they're substantially different (not just formatting)
          const winnerNorm = winner.address.toLowerCase().replace(/[^a-z0-9]/g, "");
          const loserNorm = loser.address.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (winnerNorm !== loserNorm && !winnerNorm.includes(loserNorm) && !loserNorm.includes(winnerNorm)) {
            results.warnings.push(
              `Different addresses for ${normalizedName}: "${winner.address}" vs "${loser.address}" - merging anyway (loser has lower score)`
            );
          }
        }
      }

      let restaurantRewires = 0;

      if (!dryRun) {
        // Rewire restaurants pointing to losers
        for (const loser of losers) {
          const { data: affectedRestaurants, error: rewireError } = await supabase
            .from("restaurants")
            .update({ business_profile_id: winner.id })
            .eq("business_profile_id", loser.id)
            .select("id");

          if (rewireError) {
            results.errors.push(`Failed to rewire restaurants for ${loser.name}: ${rewireError.message}`);
          } else {
            restaurantRewires += affectedRestaurants?.length || 0;
          }

          // Hide the loser and set merged_into_id (keep status as-is to avoid constraint issues)
          const { error: hideError } = await supabase
            .from("business_profiles")
            .update({
              is_hidden: true,
              merged_into_id: winner.id,
            })
            .eq("id", loser.id);

          if (hideError) {
            results.errors.push(`Failed to hide loser ${loser.name}: ${hideError.message}`);
          }
        }
      } else {
        // Dry run: count what would be rewired
        for (const loser of losers) {
          const { count } = await supabase
            .from("restaurants")
            .select("*", { count: "exact", head: true })
            .eq("business_profile_id", loser.id);
          restaurantRewires += count || 0;
        }
      }

      results.merges.push({
        normalized_name: normalizedName,
        winner: { id: winner.id, name: winner.name, score: winner.score },
        losers: losers.map((l) => ({ id: l.id, name: l.name, score: l.score })),
        restaurant_rewires: restaurantRewires,
      });

      results.total_merges += losers.length;
      results.total_rewires += restaurantRewires;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Merge error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
