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

    const results = {
      profilesCreated: 0,
      restaurantsLinked: 0,
      errors: [] as string[],
    };

    // Step 1: Get all restaurants
    const { data: restaurants, error: fetchError } = await supabase
      .from("restaurants")
      .select("id, name, address, city, website, phone, google_place_id, business_profile_id");

    if (fetchError) {
      throw new Error(`Failed to fetch restaurants: ${fetchError.message}`);
    }

    console.log(`Found ${restaurants?.length || 0} restaurants to process`);

    // Step 2: Get existing business profiles for matching
    const { data: existingProfiles, error: profilesError } = await supabase
      .from("business_profiles")
      .select("id, name, normalized_name, google_place_id, address, city");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // Create lookup maps
    const profileByPlaceId = new Map<string, any>();
    const profileByNormalizedName = new Map<string, any>();

    for (const profile of existingProfiles || []) {
      if (profile.google_place_id) {
        profileByPlaceId.set(profile.google_place_id, profile);
      }
      if (profile.normalized_name) {
        profileByNormalizedName.set(profile.normalized_name, profile);
      }
    }

    // Step 3: Process each restaurant
    for (const restaurant of restaurants || []) {
      // Skip if already linked
      if (restaurant.business_profile_id) {
        console.log(`Restaurant ${restaurant.name} already linked, skipping`);
        continue;
      }

      // Normalize the restaurant name for matching
      const normalizedName = restaurant.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      // Try to find existing profile
      let matchedProfile = null;

      // Match by google_place_id first
      if (restaurant.google_place_id && profileByPlaceId.has(restaurant.google_place_id)) {
        matchedProfile = profileByPlaceId.get(restaurant.google_place_id);
        console.log(`Matched ${restaurant.name} by google_place_id`);
      }
      // Fallback to normalized name
      else if (profileByNormalizedName.has(normalizedName)) {
        matchedProfile = profileByNormalizedName.get(normalizedName);
        console.log(`Matched ${restaurant.name} by normalized name`);
      }

      if (matchedProfile) {
        // Link to existing profile
        const { error: linkError } = await supabase
          .from("restaurants")
          .update({ business_profile_id: matchedProfile.id })
          .eq("id", restaurant.id);

        if (linkError) {
          results.errors.push(`Failed to link ${restaurant.name}: ${linkError.message}`);
        } else {
          results.restaurantsLinked++;
        }
      } else {
        // Create new business profile
        const { data: newProfile, error: createError } = await supabase
          .from("business_profiles")
          .insert({
            name: restaurant.name,
            business_type: "restaurant",
            category: "dining",
            address: restaurant.address,
            city: restaurant.city,
            website: restaurant.website,
            phone: restaurant.phone,
            google_place_id: restaurant.google_place_id,
            geo_tier: 1,
            source_confidence: "high",
            status: "active",
          })
          .select("id")
          .single();

        if (createError) {
          results.errors.push(`Failed to create profile for ${restaurant.name}: ${createError.message}`);
          continue;
        }

        results.profilesCreated++;
        console.log(`Created profile for ${restaurant.name}: ${newProfile.id}`);

        // Link restaurant to new profile
        const { error: linkError } = await supabase
          .from("restaurants")
          .update({ business_profile_id: newProfile.id })
          .eq("id", restaurant.id);

        if (linkError) {
          results.errors.push(`Failed to link ${restaurant.name} after creation: ${linkError.message}`);
        } else {
          results.restaurantsLinked++;
        }

        // Add to lookup map for subsequent matches
        profileByNormalizedName.set(normalizedName, newProfile);
      }
    }

    // Step 4: Get final counts
    const { count: totalProfiles } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true });

    const { count: linkedRestaurants } = await supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .not("business_profile_id", "is", null);

    const { count: unlinkedRestaurants } = await supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .is("business_profile_id", null);

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          ...results,
          totalProfiles,
          linkedRestaurants,
          unlinkedRestaurants,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Backfill error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
