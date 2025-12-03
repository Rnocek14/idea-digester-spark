import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Topic-specific civic image libraries for smart keyword mapping
type CivicTopic = 'land_use' | 'historic' | 'council' | 'parks' | 'lakefront' | 'library' | 'safety' | 'tourism' | 'utilities' | 'finance' | 'default';

const CIVIC_IMAGE_LIBRARIES: Record<CivicTopic, string[]> = {
  land_use: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80", // House/development concept
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80", // Construction site
    "https://images.unsplash.com/photo-1486325212027-8a9ce835dc2e?w=800&q=80", // Suburban neighborhood aerial
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80", // Residential development
  ],
  historic: [
    "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80", // Small town downtown
    "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80", // Old brick commercial building
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80", // Small town main street
    "https://images.unsplash.com/photo-1594398028856-9b00722cefbc?w=800&q=80", // Tree-lined residential street
  ],
  council: [
    "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80", // Council meeting room
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80", // Business meeting at table
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80", // People in discussion
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80", // Government/office interior
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

// Generic OG image patterns to detect and replace
const GENERIC_OG_PATTERNS = ["IconModuleCalendar", "calendar-icon", "default-event", "placeholder"];

function detectCivicTopic(title: string): CivicTopic {
  const t = title.toLowerCase();
  
  // Order matters: more specific matches first to avoid false positives
  // Land use/development catches Hillmoor, rezoning, subdivisions before historic
  if (t.includes('hillmoor') || t.includes('development') || t.includes('rezoning') || t.includes('zoning') || 
      t.includes('subdivision') || t.includes('neighborhood plan') || t.includes('annexation') || 
      t.includes('redevelopment') || t.includes('plat') || t.includes('land use')) return 'land_use';
  if (t.includes('historic') || t.includes('preservation')) return 'historic';
  // Council/governance catches general government meetings
  if (t.includes('common council') || t.includes('city council') || t.includes('council') || 
      t.includes('committee of the whole') || t.includes('governing body') || t.includes('board of aldermen')) return 'council';
  if (t.includes('park') || t.includes('cemetery') || t.includes('tree') || t.includes('avian')) return 'parks';
  if (t.includes('library')) return 'library';
  if (t.includes('police') || t.includes('fire') || t.includes('court') || t.includes('safety')) return 'safety';
  if (t.includes('tourism') || t.includes('visitor')) return 'tourism';
  // Utilities before lakefront so "Lake Geneva Utility Commission" → utilities, not lakefront
  if (t.includes('utility') || t.includes('utilities') || t.includes('water') || t.includes('sewer')) return 'utilities';
  if (t.includes('finance') || t.includes('licensing') || t.includes('regulation') || t.includes('budget')) return 'finance';
  // Lakefront last among specifics (catches piers, harbors, lake-related)
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
  
  // Deterministic hash using storyId + topic for consistency
  const key = `${storyId}:${topic}`;
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return pool[hash % pool.length];
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

    console.log("[prepare-posts] Starting post preparation...");

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

    // OPTIMIZATION: Only fetch recent stories (last 2 days) with hard limit
    const since = new Date();
    since.setDate(since.getDate() - 2);

    // Fetch eligible content: approved/auto_published/published, safe, with voice variants
    // Order by breaking news first, then priority score, then creation date
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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Define platform scheduling intervals (in hours)
    const platformConfig: Record<string, { interval: number; maxPerDay: number }> = {
      instagram: { interval: 4, maxPerDay: 3 },
      facebook: { interval: 6, maxPerDay: 2 },
      x: { interval: 3, maxPerDay: 5 },
    };

    let preparedCount = 0;
    let breakingPrepared = 0;
    let civicSkippedIG = 0;
    let curatedCivicUsed = 0;
    const now = new Date();

    // OPTIMIZATION: Pre-fetch last scheduled time for each platform (3 queries instead of N*3)
    const lastScheduledByPlatform: Record<string, Date> = {};
    for (const platform of Object.keys(platformConfig)) {
      const { data: recentPosts } = await supabaseClient
        .from("post_queue")
        .select("scheduled_for")
        .eq("platform", platform)
        .order("scheduled_for", { ascending: false })
        .limit(1);

      if (recentPosts && recentPosts.length > 0) {
        lastScheduledByPlatform[platform] = new Date(recentPosts[0].scheduled_for);
      } else {
        // Start 1 hour from now if no posts
        lastScheduledByPlatform[platform] = new Date(now.getTime() + 60 * 60 * 1000);
      }
    }
    console.log("[prepare-posts] Pre-fetched last scheduled times for all platforms");

    for (const story of eligibleStories) {
      const category = (story.category || '').toLowerCase();
      const isCivic = category === 'civic';
      
      // STEP 1: Determine image ONCE per story (before platform loop)
      let finalImageUrl = story.image_url;
      let generatedImageUrl = null;
      let imageSource = 'og';
      const isSponsored = story.is_sponsored || false;
      
      // Check if this is a generic civic OG image that needs replacement
      const hasGenericCivicImage = isCivic && isGenericCivicImage(story.image_url);
      
      if (hasGenericCivicImage) {
        // Replace generic civic OG with topic-aware curated image
        const civicTopic = detectCivicTopic(story.title);
        finalImageUrl = getCuratedCivicImage(story.id, story.title);
        imageSource = 'curated_civic';
        curatedCivicUsed++;
        console.log(`[prepare-posts] Using curated civic image (${civicTopic}) for story ${story.id}: "${story.title}"`);
      } else if (isSponsored && !story.image_url) {
        // ONLY generate AI image for sponsored posts (mandatory)
        console.log(`[prepare-posts] Sponsored story ${story.id} needs AI image`);
        
        try {
          const { data: aiImageData, error: aiError } = await supabaseClient.functions.invoke(
            'generate-post-image',
            {
              body: { story_id: story.id, platform: 'instagram' }
            }
          );

          if (aiError || !aiImageData?.image_url) {
            console.log(`[prepare-posts] BLOCKING sponsored story ${story.id} - AI generation failed`);
            continue; // Skip entire story if sponsored and no AI image
          }
          
          generatedImageUrl = aiImageData.image_url;
          finalImageUrl = generatedImageUrl;
          imageSource = 'ai_sponsored';
          console.log(`[prepare-posts] Generated AI image for sponsored story ${story.id}`);
        } catch (err) {
          console.error(`[prepare-posts] Exception generating AI image:`, err);
          console.log(`[prepare-posts] BLOCKING sponsored story ${story.id} - exception during AI generation`);
          continue; // Skip to next story
        }
      } else if (isSponsored && story.image_url) {
        // Sponsored with existing image - use it
        finalImageUrl = story.image_url;
        imageSource = 'existing_sponsored';
        console.log(`[prepare-posts] Sponsored story ${story.id} using existing image`);
      } else if (story.image_source === 'AI') {
        imageSource = 'ai';
      }
      
      // STEP 2: Now loop through platforms using the SAME image
      for (const [platform, config] of Object.entries(platformConfig)) {
        // CIVIC FILTER: Skip ALL civic content on Instagram
        if (platform === 'instagram' && isCivic) {
          console.log(`[prepare-posts] Skipping civic content on Instagram: "${story.title}"`);
          civicSkippedIG++;
          continue;
        }
        
        // Skip Instagram if no image available (non-civic)
        if (platform === 'instagram' && !finalImageUrl) {
          console.log(`[prepare-posts] Skipping Instagram for story ${story.id} - no image`);
          continue;
        }
        
        // Check if this story has already been queued/posted to this platform
        const { data: existing } = await supabaseClient
          .from("post_queue")
          .select("id")
          .eq("story_id", story.id)
          .eq("platform", platform)
          .single();

        if (existing) {
          console.log(`[prepare-posts] Story ${story.id} already queued for ${platform}, skipping`);
          continue;
        }

        // OPTIMIZATION: Use pre-fetched last scheduled time and advance pointer
        const isBreaking = story.is_breaking || false;
        let scheduledFor: Date;
        
        if (isBreaking && platform === 'x') {
          // BREAKING NEWS OVERRIDE: X gets breaking news immediately (within 2 minutes)
          scheduledFor = new Date(now.getTime() + 2 * 60 * 1000);
          console.log(`[prepare-posts] 🔴 BREAKING: Scheduling ${platform} post immediately`);
        } else {
          // Schedule after the last scheduled time + interval
          scheduledFor = new Date(
            lastScheduledByPlatform[platform].getTime() + config.interval * 60 * 60 * 1000
          );
        }
        
        // Update the pointer for next post on this platform
        lastScheduledByPlatform[platform] = scheduledFor;

        // Get the appropriate voice variant for this platform
        const postText = story[`content_${platform}`];
        
        if (!postText) {
          console.log(`[prepare-posts] No content for ${platform} on story ${story.id}, skipping`);
          continue;
        }

        // Create post_queue entry
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
            },
          });

        if (insertError) {
          console.error(`[prepare-posts] Error inserting post for ${platform}:`, insertError);
          continue;
        }

        const breakingLabel = isBreaking ? ' 🔴 BREAKING' : '';
        console.log(`[prepare-posts] Scheduled ${platform} post for ${scheduledFor.toISOString()} [${imageSource}]${breakingLabel}`);
        preparedCount++;
        if (isBreaking) breakingPrepared++;
      }
    }

    console.log(`[prepare-posts] Prepared ${preparedCount} posts across all platforms`);
    console.log(`[prepare-posts] Stats: ${breakingPrepared} breaking, ${civicSkippedIG} civic skipped on IG, ${curatedCivicUsed} curated civic images used`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prepared ${preparedCount} posts for social media${breakingPrepared > 0 ? ` (${breakingPrepared} breaking)` : ''}`,
        prepared: preparedCount,
        breakingPrepared,
        civicSkippedIG,
        curatedCivicUsed,
        storiesProcessed: eligibleStories.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[prepare-posts] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
