import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deal type to content title templates
const DEAL_TEMPLATES: Record<string, { title: string; category: string }> = {
  'fish-fry': { title: 'Fish Fry at {restaurant}', category: 'dining' },
  'happy-hour': { title: 'Happy Hour at {restaurant}', category: 'dining' },
  'brunch': { title: 'Brunch at {restaurant}', category: 'dining' },
  'daily-special': { title: 'Daily Special at {restaurant}', category: 'dining' },
  'weekly-special': { title: 'Weekly Special at {restaurant}', category: 'dining' },
  'special': { title: 'Special at {restaurant}', category: 'dining' },
};

// Curated dining images by deal type
const DINING_IMAGE_LIBRARIES: Record<string, string[]> = {
  'fish-fry': [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80", // fried fish plate
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", // fish and chips
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80", // seafood plate
  ],
  'happy-hour': [
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80", // cocktails
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80", // bar scene
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80", // drinks
    "https://images.unsplash.com/photo-1574096079513-d8259312b785?w=800&q=80", // beer flight
  ],
  'brunch': [
    "https://images.unsplash.com/photo-1533920379810-6bed1ccd1228?w=800&q=80", // brunch spread
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80", // eggs benedict
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80", // pancakes
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80", // french toast
  ],
  'default': [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", // restaurant plating
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80", // restaurant interior
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", // dining atmosphere
  ],
};

function getDiningImage(dealType: string, dealId: string): string {
  const type = dealType.toLowerCase();
  const images = DINING_IMAGE_LIBRARIES[type] || DINING_IMAGE_LIBRARIES['default'];
  const hash = dealId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return images[hash % images.length];
}

function formatDays(days: string[] | null): string {
  if (!days || days.length === 0) return '';
  if (days.length === 1) return days[0];
  if (days.length === 7) return 'every day';
  return days.join(', ');
}

function formatTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  const start = startTime.replace(/:00$/, '');
  if (!endTime) return start;
  const end = endTime.replace(/:00$/, '');
  return `${start} - ${end}`;
}

function buildDealContent(deal: any, restaurant: any): { title: string; content: string; summary: string } {
  const template = DEAL_TEMPLATES[deal.deal_type] || DEAL_TEMPLATES['special'];
  const title = template.title.replace('{restaurant}', restaurant?.name || deal.name);
  
  const parts: string[] = [];
  
  // Main description
  if (deal.description) {
    parts.push(deal.description);
  }
  
  // Days and times
  const daysStr = formatDays(deal.days);
  const timeStr = formatTime(deal.start_time, deal.end_time);
  if (daysStr && timeStr) {
    parts.push(`Available ${daysStr} from ${timeStr}.`);
  } else if (daysStr) {
    parts.push(`Available ${daysStr}.`);
  } else if (timeStr) {
    parts.push(`Available ${timeStr}.`);
  }
  
  // Fish fry specifics
  if (deal.deal_type === 'fish-fry') {
    const fishDetails: string[] = [];
    if (deal.fish_type) fishDetails.push(deal.fish_type);
    if (deal.price) fishDetails.push(deal.price);
    if (deal.all_you_can_eat) fishDetails.push('all-you-can-eat');
    if (deal.sides) fishDetails.push(`with ${deal.sides}`);
    if (fishDetails.length > 0) {
      parts.push(`Fish fry features: ${fishDetails.join(', ')}.`);
    }
  }
  
  // Happy hour specifics
  if (deal.deal_type === 'happy-hour') {
    if (deal.drink_deals && deal.drink_deals.length > 0) {
      parts.push(`Drink specials: ${deal.drink_deals.join(', ')}.`);
    }
    if (deal.food_deals && deal.food_deals.length > 0) {
      parts.push(`Food specials: ${deal.food_deals.join(', ')}.`);
    }
  }
  
  // Location
  if (restaurant?.address) {
    parts.push(`Located at ${restaurant.address}.`);
  }
  
  // Evidence/source
  if (deal.evidence_snippet) {
    parts.push(`Source: "${deal.evidence_snippet.substring(0, 100)}${deal.evidence_snippet.length > 100 ? '...' : ''}"`);
  }
  
  const content = parts.join(' ');
  const summary = deal.description || `${deal.deal_type} at ${restaurant?.name || deal.name}`;
  
  return { title, content, summary };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log("[sync-dining-content-v2] Starting dining content sync...");

    // Get recent/updated deals not yet syndicated
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: deals, error: dealsError } = await supabase
      .from("restaurant_deals")
      .select(`
        *,
        restaurant:restaurants(id, name, address, website, slug)
      `)
      .gte("last_seen_at", oneDayAgo.toISOString())
      .gte("confidence_score", 0.5)
      .neq("verification_status", "outdated")
      .order("last_seen_at", { ascending: false })
      .limit(50);

    if (dealsError) {
      console.error("[sync-dining-content-v2] Error fetching deals:", dealsError);
      throw dealsError;
    }

    console.log(`[sync-dining-content-v2] Found ${deals?.length || 0} recent deals`);

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const deal of deals || []) {
      try {
        // Check if already syndicated (by deal_hash in metadata)
        const { data: existing } = await supabase
          .from("content_queue")
          .select("id")
          .eq("metadata->deal_hash", deal.deal_hash)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const restaurant = deal.restaurant;
        const { title, content, summary } = buildDealContent(deal, restaurant);
        const imageUrl = getDiningImage(deal.deal_type, deal.id);

        // Create content_queue entry
        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            title,
            content,
            summary,
            category: "dining",
            original_url: deal.evidence_url || restaurant?.website,
            image_url: imageUrl,
            image_source: "curated_dining",
            safety_level: "safe",
            geo_tier: 1,
            geo_label: "Lake Geneva",
            status: "pending",
            metadata: {
              deal_id: deal.id,
              deal_hash: deal.deal_hash,
              deal_type: deal.deal_type,
              restaurant_id: restaurant?.id,
              restaurant_slug: restaurant?.slug,
              source: "dining-scraper-v2"
            }
          });

        if (insertError) {
          console.error(`[sync-dining-content-v2] Insert error for deal ${deal.id}:`, insertError);
          errors.push(`${deal.id}: ${insertError.message}`);
          continue;
        }

        synced++;
        console.log(`[sync-dining-content-v2] ✅ Synced: ${title}`);
      } catch (err) {
        console.error(`[sync-dining-content-v2] Error processing deal ${deal.id}:`, err);
        errors.push(`${deal.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "sync_dining_content",
      entity_type: "content_queue",
      actor_type: "system",
      message: `Synced ${synced} dining deals to content queue (${skipped} already existed)`,
      details: { synced, skipped, errors: errors.slice(0, 5) }
    });

    console.log(`[sync-dining-content-v2] Complete: ${synced} synced, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-dining-content-v2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
