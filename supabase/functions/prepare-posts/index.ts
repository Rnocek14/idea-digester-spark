import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Curated civic images - Lake Geneva City Hall, downtown, and civic landmarks
// These are used when OG image is a generic calendar icon (7 images for variety)
const CURATED_CIVIC_IMAGES = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Walworth_County_Courthouse.jpg/1280px-Walworth_County_Courthouse.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Lake_Geneva%2C_Wisconsin_-_Main_Street.jpg/1280px-Lake_Geneva%2C_Wisconsin_-_Main_Street.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Lake_Geneva%2C_Wisconsin_-_downtown.jpg/1280px-Lake_Geneva%2C_Wisconsin_-_downtown.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Lake_Geneva_Wisconsin_Riviera.jpg/1280px-Lake_Geneva_Wisconsin_Riviera.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Lake_Geneva_Wisconsin_Library_Park.jpg/1280px-Lake_Geneva_Wisconsin_Library_Park.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Geneva_Lake%2C_Wisconsin.jpg/1280px-Geneva_Lake%2C_Wisconsin.jpg",
];

// Generic OG image patterns to detect and replace
const GENERIC_OG_PATTERNS = [
  "IconModuleCalendar",
  "calendar-icon",
  "default-event",
  "placeholder",
];

function isGenericCivicImage(imageUrl: string | null): boolean {
  if (!imageUrl) return false;
  return GENERIC_OG_PATTERNS.some(pattern => 
    imageUrl.toLowerCase().includes(pattern.toLowerCase())
  );
}

function getCuratedCivicImage(storyId: string): string {
  // Use story ID hash to get consistent image per story
  const hash = storyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURATED_CIVIC_IMAGES[hash % CURATED_CIVIC_IMAGES.length];
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
        // Replace generic civic OG with curated image
        finalImageUrl = getCuratedCivicImage(story.id);
        imageSource = 'curated_civic';
        curatedCivicUsed++;
        console.log(`[prepare-posts] Using curated civic image for story ${story.id}`);
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
