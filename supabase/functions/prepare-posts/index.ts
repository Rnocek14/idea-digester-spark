import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Optimal posting time slots in Central Time (24-hour format)
// These are peak engagement hours for local news audiences
const OPTIMAL_SLOTS_CENTRAL = [8, 10, 12, 14, 16, 18]; // 8am, 10am, 12pm, 2pm, 4pm, 6pm

// Topic-specific civic image libraries for smart keyword mapping
type CivicTopic = 'land_use' | 'historic' | 'council' | 'parks' | 'lakefront' | 'library' | 'safety' | 'tourism' | 'utilities' | 'finance' | 'default';

const CIVIC_IMAGE_LIBRARIES: Record<CivicTopic, string[]> = {
  land_use: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
    "https://images.unsplash.com/photo-1486325212027-8a9ce835dc2e?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  ],
  historic: [
    "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80",
    "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
    "https://images.unsplash.com/photo-1594398028856-9b00722cefbc?w=800&q=80",
  ],
  council: [
    "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80",
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80",
  ],
  parks: [
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800&q=80",
  ],
  lakefront: [
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80",
    "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  ],
  library: [
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
  ],
  safety: [
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80",
    "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&q=80",
  ],
  tourism: [
    "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80",
    "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=800&q=80",
  ],
  utilities: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  ],
  finance: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  ],
  default: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Walworth_County_Courthouse.jpg/1280px-Walworth_County_Courthouse.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Lake_Geneva_Wisconsin_Riviera.jpg/1280px-Lake_Geneva_Wisconsin_Riviera.jpg",
  ],
};

const GENERIC_OG_PATTERNS = ["IconModuleCalendar", "calendar-icon", "default-event", "placeholder"];

function detectCivicTopic(title: string): CivicTopic {
  const t = title.toLowerCase();
  
  if (t.includes('hillmoor') || t.includes('development') || t.includes('rezoning') || t.includes('zoning') || 
      t.includes('subdivision') || t.includes('neighborhood plan') || t.includes('annexation') || 
      t.includes('redevelopment') || t.includes('plat') || t.includes('land use')) return 'land_use';
  if (t.includes('historic') || t.includes('preservation')) return 'historic';
  if (t.includes('common council') || t.includes('city council') || t.includes('council') || 
      t.includes('committee of the whole') || t.includes('governing body') || t.includes('board of aldermen')) return 'council';
  if (t.includes('park') || t.includes('cemetery') || t.includes('tree') || t.includes('avian')) return 'parks';
  if (t.includes('library')) return 'library';
  if (t.includes('police') || t.includes('fire') || t.includes('court') || t.includes('safety')) return 'safety';
  if (t.includes('tourism') || t.includes('visitor')) return 'tourism';
  if (t.includes('utility') || t.includes('utilities') || t.includes('water') || t.includes('sewer')) return 'utilities';
  if (t.includes('finance') || t.includes('licensing') || t.includes('regulation') || t.includes('budget')) return 'finance';
  if (t.includes('pier') || t.includes('harbor') || t.includes('harbour') || t.includes('lakefront')) return 'lakefront';
  
  return 'default';
}

function isGenericCivicImage(imageUrl: string | null): boolean {
  if (!imageUrl) return false;
  return GENERIC_OG_PATTERNS.some(pattern => imageUrl.toLowerCase().includes(pattern.toLowerCase()));
}

function getCuratedCivicImage(storyId: string, title: string): string {
  const topic = detectCivicTopic(title);
  const images = CIVIC_IMAGE_LIBRARIES[topic] ?? CIVIC_IMAGE_LIBRARIES.default;
  const pool = images.length > 0 ? images : CIVIC_IMAGE_LIBRARIES.default;
  
  const key = `${storyId}:${topic}`;
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return pool[hash % pool.length];
}

/**
 * Get the next available optimal posting slot for a platform.
 * Returns a Date in UTC that corresponds to an optimal Central Time slot.
 */
function getNextOptimalSlot(
  platform: string, 
  usedSlots: Set<string>, // Set of "YYYY-MM-DD-HH" strings already scheduled
  now: Date
): Date {
  // Convert now to Central Time for slot calculation
  const centralNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const currentCentralHour = centralNow.getHours();
  const currentCentralMinutes = centralNow.getMinutes();
  
  // Start looking from today
  let searchDate = new Date(centralNow);
  searchDate.setHours(0, 0, 0, 0);
  
  // Look up to 7 days ahead
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(searchDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    
    for (const slotHour of OPTIMAL_SLOTS_CENTRAL) {
      // Skip slots that have already passed today
      if (dayOffset === 0) {
        if (slotHour < currentCentralHour || (slotHour === currentCentralHour && currentCentralMinutes > 0)) {
          continue;
        }
      }
      
      // Create slot key for deduplication
      const dateStr = checkDate.toISOString().split('T')[0];
      const slotKey = `${platform}-${dateStr}-${slotHour}`;
      
      if (!usedSlots.has(slotKey)) {
        usedSlots.add(slotKey);
        
        // Create the scheduled time in Central, then convert to UTC
        const scheduledCentral = new Date(checkDate);
        scheduledCentral.setHours(slotHour, 0, 0, 0);
        
        // Convert Central Time to UTC by parsing back
        // Central is UTC-6 (CST) or UTC-5 (CDT)
        const centralString = scheduledCentral.toLocaleString("en-US", { timeZone: "America/Chicago" });
        const utcDate = new Date(centralString + " CST");
        
        // More reliable: calculate offset
        const tempDate = new Date();
        const utcTime = tempDate.getTime();
        const centralTime = new Date(tempDate.toLocaleString("en-US", { timeZone: "America/Chicago" })).getTime();
        const offset = utcTime - centralTime;
        
        const scheduledUTC = new Date(scheduledCentral.getTime() + offset);
        
        console.log(`[prepare-posts] Next optimal slot for ${platform}: ${slotHour}:00 CT on ${dateStr} (UTC: ${scheduledUTC.toISOString()})`);
        return scheduledUTC;
      }
    }
  }
  
  // Fallback: 24 hours from now if somehow no slots found
  console.log(`[prepare-posts] Warning: No optimal slot found, using 24h fallback`);
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[prepare-posts] Starting post preparation with OPTIMAL SCHEDULING...");

    // KILL SWITCH CHECK
    const { data: settings } = await supabaseClient
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = (settings?.value as any)?.enabled !== false;
    const socialEnabled = (settings?.value as any)?.social_enabled !== false;
    
    if (!automationEnabled || !socialEnabled) {
      console.log("[prepare-posts] ⛔ Social automation is disabled via kill switch");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Social automation is disabled",
          automation_enabled: automationEnabled,
          social_enabled: socialEnabled
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[prepare-posts] ✅ Kill switch check passed");

    const now = new Date();
    
    // Pre-fetch existing scheduled posts to know which slots are taken
    const usedSlotsByPlatform: Record<string, Set<string>> = {
      instagram: new Set(),
      facebook: new Set(),
      x: new Set(),
    };
    
    // Get all pending posts scheduled in the future
    const { data: existingPosts } = await supabaseClient
      .from("post_queue")
      .select("platform, scheduled_for")
      .eq("status", "pending")
      .gte("scheduled_for", now.toISOString());
    
    if (existingPosts) {
      for (const post of existingPosts) {
        const scheduledDate = new Date(post.scheduled_for);
        const centralTime = new Date(scheduledDate.toLocaleString("en-US", { timeZone: "America/Chicago" }));
        const dateStr = centralTime.toISOString().split('T')[0];
        const hour = centralTime.getHours();
        const slotKey = `${post.platform}-${dateStr}-${hour}`;
        usedSlotsByPlatform[post.platform]?.add(slotKey);
      }
    }
    console.log(`[prepare-posts] Pre-loaded ${existingPosts?.length || 0} existing scheduled posts`);

    // Fetch eligible content
    const since = new Date();
    since.setDate(since.getDate() - 2);

    const { data: eligibleStories, error: fetchError } = await supabaseClient
      .from("content_queue")
      .select("*")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .gte("created_at", since.toISOString())
      .not("content_facebook", "is", null)
      .not("content_instagram", "is", null)
      .not("content_x", "is", null)
      .order("is_breaking", { ascending: false })
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error("[prepare-posts] Error fetching stories:", fetchError);
      throw fetchError;
    }

    const breakingCount = eligibleStories?.filter(s => s.is_breaking).length || 0;
    console.log(`[prepare-posts] Found ${eligibleStories?.length || 0} eligible stories (${breakingCount} breaking)`);

    if (!eligibleStories || eligibleStories.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible stories found",
          prepared: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformConfig: Record<string, { maxPerDay: number }> = {
      instagram: { maxPerDay: 3 },
      facebook: { maxPerDay: 2 },
      x: { maxPerDay: 5 },
    };

    let preparedCount = 0;
    let breakingPrepared = 0;
    let civicSkippedIG = 0;
    let curatedCivicUsed = 0;

    for (const story of eligibleStories) {
      const category = (story.category || '').toLowerCase();
      const isCivic = category === 'civic';
      
      // Determine image ONCE per story
      let finalImageUrl = story.image_url;
      let generatedImageUrl = null;
      let imageSource = 'og';
      const isSponsored = story.is_sponsored || false;
      
      const hasGenericCivicImage = isCivic && isGenericCivicImage(story.image_url);
      
      if (hasGenericCivicImage) {
        const civicTopic = detectCivicTopic(story.title);
        finalImageUrl = getCuratedCivicImage(story.id, story.title);
        imageSource = 'curated_civic';
        curatedCivicUsed++;
        console.log(`[prepare-posts] Using curated civic image (${civicTopic}) for story ${story.id}`);
      } else if (isSponsored && !story.image_url) {
        console.log(`[prepare-posts] Sponsored story ${story.id} needs AI image`);
        
        try {
          const { data: aiImageData, error: aiError } = await supabaseClient.functions.invoke(
            'generate-post-image',
            { body: { story_id: story.id, platform: 'instagram' } }
          );

          if (aiError || !aiImageData?.image_url) {
            console.log(`[prepare-posts] BLOCKING sponsored story ${story.id} - AI generation failed`);
            continue;
          }
          
          generatedImageUrl = aiImageData.image_url;
          finalImageUrl = generatedImageUrl;
          imageSource = 'ai_sponsored';
        } catch (err) {
          console.error(`[prepare-posts] Exception generating AI image:`, err);
          continue;
        }
      } else if (isSponsored && story.image_url) {
        finalImageUrl = story.image_url;
        imageSource = 'existing_sponsored';
      } else if (story.image_source === 'AI') {
        imageSource = 'ai';
      }
      
      // Loop through platforms
      for (const [platform, config] of Object.entries(platformConfig)) {
        // Skip civic content on Instagram
        if (platform === 'instagram' && isCivic) {
          civicSkippedIG++;
          continue;
        }
        
        // Skip Instagram if no image
        if (platform === 'instagram' && !finalImageUrl) {
          continue;
        }
        
        // Check if already queued
        const { data: existing } = await supabaseClient
          .from("post_queue")
          .select("id")
          .eq("story_id", story.id)
          .eq("platform", platform)
          .single();

        if (existing) {
          continue;
        }

        const isBreaking = story.is_breaking || false;
        let scheduledFor: Date;
        
        if (isBreaking && platform === 'x') {
          // BREAKING NEWS: schedule immediately (within 2 minutes)
          scheduledFor = new Date(now.getTime() + 2 * 60 * 1000);
          console.log(`[prepare-posts] 🔴 BREAKING: Scheduling ${platform} post immediately`);
        } else {
          // Use optimal slot scheduling
          scheduledFor = getNextOptimalSlot(platform, usedSlotsByPlatform[platform], now);
        }

        const postText = story[`content_${platform}`];
        
        if (!postText) {
          continue;
        }

        const { error: insertError } = await supabaseClient
          .from("post_queue")
          .insert({
            story_id: story.id,
            platform,
            post_text: postText,
            image_url: finalImageUrl,
            generated_image_url: generatedImageUrl,
            is_sponsored: isSponsored,
            sponsor_id: story.sponsor_id || null,
            scheduled_for: scheduledFor.toISOString(),
            status: "pending",
            metadata: {
              story_title: story.title,
              story_category: story.category,
              image_source: imageSource,
              civic_topic: isCivic ? detectCivicTopic(story.title) : null,
              image_generated: generatedImageUrl ? true : false,
              sponsored_safe: isSponsored ? (generatedImageUrl ? true : false) : true,
              type: isBreaking ? 'breaking' : 'normal',
              priority_score: story.priority_score || 0,
              scheduling: 'optimal_slots',
            },
          });

        if (insertError) {
          console.error(`[prepare-posts] Error inserting post for ${platform}:`, insertError);
          continue;
        }

        const breakingLabel = isBreaking ? ' 🔴 BREAKING' : '';
        console.log(`[prepare-posts] ✅ Scheduled ${platform} post for ${scheduledFor.toISOString()} [${imageSource}]${breakingLabel}`);
        preparedCount++;
        if (isBreaking) breakingPrepared++;
      }
    }

    console.log(`[prepare-posts] Prepared ${preparedCount} posts with OPTIMAL SCHEDULING`);
    console.log(`[prepare-posts] Stats: ${breakingPrepared} breaking, ${civicSkippedIG} civic skipped on IG, ${curatedCivicUsed} curated civic images`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prepared ${preparedCount} posts with optimal scheduling${breakingPrepared > 0 ? ` (${breakingPrepared} breaking)` : ''}`,
        prepared: preparedCount,
        breakingPrepared,
        civicSkippedIG,
        curatedCivicUsed,
        storiesProcessed: eligibleStories.length,
        scheduling: 'optimal_slots',
        slots: OPTIMAL_SLOTS_CENTRAL.map(h => `${h}:00 CT`),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[prepare-posts] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
