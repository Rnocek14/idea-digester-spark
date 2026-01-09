import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lake Geneva area center points
const DEFAULT_CENTERS = [
  { name: "Downtown Lake Geneva", lat: 42.5917, lng: -88.4334, radius: 3, geo_tier: 1 },
  { name: "Williams Bay", lat: 42.5778, lng: -88.5417, radius: 2, geo_tier: 1 },
  { name: "Fontana", lat: 42.5514, lng: -88.5756, radius: 2, geo_tier: 1 },
  { name: "Geneva National", lat: 42.5600, lng: -88.4800, radius: 2, geo_tier: 1 },
];

// Map Google Places types to our business_type enum
const TYPE_MAPPING: Record<string, string> = {
  restaurant: "restaurant",
  food: "restaurant",
  cafe: "restaurant",
  bar: "restaurant",
  bakery: "restaurant",
  meal_delivery: "restaurant",
  meal_takeaway: "restaurant",
  american_restaurant: "restaurant",
  italian_restaurant: "restaurant",
  mexican_restaurant: "restaurant",
  chinese_restaurant: "restaurant",
  japanese_restaurant: "restaurant",
  indian_restaurant: "restaurant",
  thai_restaurant: "restaurant",
  pizza_restaurant: "restaurant",
  seafood_restaurant: "restaurant",
  steak_house: "restaurant",
  breakfast_restaurant: "restaurant",
  brunch_restaurant: "restaurant",
  coffee_shop: "restaurant",
  ice_cream_shop: "restaurant",
  lodging: "lodging",
  hotel: "lodging",
  motel: "lodging",
  resort_hotel: "lodging",
  bed_and_breakfast: "lodging",
  campground: "lodging",
  extended_stay_hotel: "lodging",
  store: "retail",
  shopping_mall: "retail",
  clothing_store: "retail",
  jewelry_store: "retail",
  shoe_store: "retail",
  hardware_store: "retail",
  home_goods_store: "retail",
  furniture_store: "retail",
  grocery_store: "retail",
  supermarket: "retail",
  convenience_store: "retail",
  liquor_store: "retail",
  florist: "retail",
  gift_shop: "retail",
  book_store: "retail",
  sporting_goods_store: "retail",
  beauty_salon: "service",
  hair_salon: "service",
  hair_care: "service",
  spa: "service",
  gym: "service",
  fitness_center: "service",
  laundry: "service",
  car_repair: "service",
  car_wash: "service",
  gas_station: "service",
  bank: "service",
  insurance_agency: "service",
  real_estate_agency: "service",
  lawyer: "service",
  accounting: "service",
  doctor: "health",
  dentist: "health",
  hospital: "health",
  pharmacy: "health",
  physiotherapist: "health",
  veterinary_care: "health",
  amusement_park: "entertainment",
  bowling_alley: "entertainment",
  casino: "entertainment",
  movie_theater: "entertainment",
  night_club: "entertainment",
  museum: "entertainment",
  art_gallery: "entertainment",
  tourist_attraction: "entertainment",
  park: "entertainment",
  golf_course: "entertainment",
  marina: "marina",
  boat_rental: "marina",
};

// Types to exclude (not useful for local directory)
const EXCLUDED_TYPES = [
  "atm",
  "post_office",
  "local_government_office",
  "courthouse",
  "fire_station",
  "police",
  "primary_school",
  "secondary_school",
  "school",
  "university",
  "church",
  "cemetery",
  "funeral_home",
  "parking",
  "transit_station",
  "bus_station",
  "train_station",
  "airport",
  "subway_station",
];

interface PlaceResult {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  types: string[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  primaryType?: string;
}

interface ImportRequest {
  centers?: Array<{ name: string; lat: number; lng: number; radius: number; geo_tier: number }>;
  dry_run?: boolean;
  max_results_per_center?: number;
}

async function fetchNearbyPlaces(
  apiKey: string,
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<PlaceResult[]> {
  const radiusMeters = radiusMiles * 1609.34;
  
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.primaryType",
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      maxResultCount: 20,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Places API error: ${data.error.message}`);
  }

  return data.places || [];
}

function mapBusinessType(types: string[], primaryType?: string): string {
  // Check primary type first
  if (primaryType && TYPE_MAPPING[primaryType]) {
    return TYPE_MAPPING[primaryType];
  }
  
  for (const type of types) {
    if (TYPE_MAPPING[type]) {
      return TYPE_MAPPING[type];
    }
  }
  return "service"; // default fallback
}

function shouldExclude(types: string[]): boolean {
  return types.some((t) => EXCLUDED_TYPES.includes(t));
}

function extractCity(address: string): string | null {
  // Extract city from formatted address (typically "Street, City, State ZIP, Country")
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    return parts[1]; // Usually the city
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body: ImportRequest = await req.json().catch(() => ({}));
    const centers = body.centers || DEFAULT_CENTERS;
    const dryRun = body.dry_run ?? false;
    const maxResultsPerCenter = body.max_results_per_center ?? 60;

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      excluded: 0,
      errors: [] as string[],
      samples: [] as Array<{ name: string; business_type: string; city: string | null; types: string[] }>,
      centers_processed: 0,
      total_places_found: 0,
    };

    // Get existing place_ids to check for updates vs inserts
    const { data: existingProfiles } = await supabase
      .from("business_profiles")
      .select("id, google_place_id")
      .not("google_place_id", "is", null);

    const existingPlaceIds = new Set((existingProfiles || []).map((p) => p.google_place_id));
    const processedPlaceIds = new Set<string>();

    for (const center of centers) {
      console.log(`Processing center: ${center.name}`);

      try {
        const places = await fetchNearbyPlaces(apiKey, center.lat, center.lng, center.radius);
        
        for (const place of places) {
          results.total_places_found++;

          // Skip if already processed in this run
          if (processedPlaceIds.has(place.id)) {
            results.skipped++;
            continue;
          }
          processedPlaceIds.add(place.id);

          // Skip excluded types
          if (shouldExclude(place.types || [])) {
            results.excluded++;
            continue;
          }

          const businessType = mapBusinessType(place.types || [], place.primaryType);
          const city = place.formattedAddress ? extractCity(place.formattedAddress) : null;
          const name = place.displayName?.text || "Unknown";

          const profileData = {
            name,
            business_type: businessType,
            category: businessType === "restaurant" ? "dining" : businessType,
            address: place.formattedAddress || null,
            city,
            phone: place.nationalPhoneNumber || null,
            website: place.websiteUri || null,
            google_place_id: place.id,
            geo_tier: center.geo_tier,
            source_confidence: "medium" as const,
            import_source: "google_places",
            last_synced_at: new Date().toISOString(),
            categories: place.types,
            status: place.businessStatus === "CLOSED_PERMANENTLY" ? "closed" : "active",
            external_payload: {
              location: place.location,
              types: place.types,
              primary_type: place.primaryType,
              business_status: place.businessStatus,
            },
          };

          // Collect samples for dry run
          if (results.samples.length < 20) {
            results.samples.push({
              name,
              business_type: businessType,
              city,
              types: place.types || [],
            });
          }

          if (!dryRun) {
            const isUpdate = existingPlaceIds.has(place.id);

            if (isUpdate) {
              const { error } = await supabase
                .from("business_profiles")
                .update({
                  name: profileData.name,
                  address: profileData.address,
                  city: profileData.city,
                  phone: profileData.phone,
                  website: profileData.website,
                  categories: profileData.categories,
                  status: profileData.status,
                  last_synced_at: profileData.last_synced_at,
                  external_payload: profileData.external_payload,
                })
                .eq("google_place_id", place.id);

              if (error) {
                results.errors.push(`Update failed for ${name}: ${error.message}`);
              } else {
                results.updated++;
              }
            } else {
              const { error } = await supabase
                .from("business_profiles")
                .insert(profileData);

              if (error) {
                // Could be duplicate from another center
                if (error.code === "23505") {
                  results.skipped++;
                } else {
                  results.errors.push(`Insert failed for ${name}: ${error.message}`);
                }
              } else {
                results.inserted++;
                existingPlaceIds.add(place.id);
              }
            }
          }
        }
      } catch (centerError) {
        const errMsg = centerError instanceof Error ? centerError.message : String(centerError);
        results.errors.push(`Center ${center.name} error: ${errMsg}`);
      }

      results.centers_processed++;
    }

    // Get final counts
    const { count: totalProfiles } = await supabase
      .from("business_profiles")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        results: {
          ...results,
          total_profiles_after: totalProfiles,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Import error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
