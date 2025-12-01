import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch eligible content: approved/auto_published/published, safe, with voice variants
    const { data: eligibleStories, error: fetchError } = await supabaseClient
      .from("content_queue")
      .select("*")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .not("content_facebook", "is", null)
      .not("content_instagram", "is", null)
      .not("content_x", "is", null);

    if (fetchError) {
      console.error("[prepare-posts] Error fetching stories:", fetchError);
      throw fetchError;
    }

    console.log(`[prepare-posts] Found ${eligibleStories?.length || 0} eligible stories`);

    if (!eligibleStories || eligibleStories.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible stories found",
          prepared: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Define platform scheduling intervals (in hours)
    const platformConfig = {
      instagram: { interval: 4, maxPerDay: 3 },
      facebook: { interval: 6, maxPerDay: 2 },
      x: { interval: 3, maxPerDay: 5 },
    };

    let preparedCount = 0;
    const now = new Date();

    for (const story of eligibleStories) {
      // Check each platform
      for (const [platform, config] of Object.entries(platformConfig)) {
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

        // Determine image handling
        let finalImageUrl = story.image_url;
        let generatedImageUrl = null;

        // Instagram requires an image - try to generate if none available
        if (platform === 'instagram' && !story.image_url) {
          console.log(`[prepare-posts] No image for story ${story.id}, generating AI image for Instagram...`);
          
          try {
            const { data: aiImageData, error: aiError } = await supabaseClient.functions.invoke(
              'generate-post-image',
              {
                body: { story_id: story.id, platform: 'instagram' }
              }
            );

            if (aiError) {
              console.error(`[prepare-posts] AI image generation failed for ${story.id}:`, aiError);
              console.log(`[prepare-posts] Skipping Instagram for story ${story.id} - no image available`);
              continue;
            }

            if (aiImageData?.image_url) {
              generatedImageUrl = aiImageData.image_url;
              finalImageUrl = generatedImageUrl;
              console.log(`[prepare-posts] Generated AI image for story ${story.id}: ${generatedImageUrl}`);
            } else {
              console.log(`[prepare-posts] No image generated, skipping Instagram for story ${story.id}`);
              continue;
            }
          } catch (err) {
            console.error(`[prepare-posts] Exception generating AI image:`, err);
            console.log(`[prepare-posts] Skipping Instagram for story ${story.id}`);
            continue;
          }
        }

        // Find the next available slot for this platform
        const { data: recentPosts } = await supabaseClient
          .from("post_queue")
          .select("scheduled_for")
          .eq("platform", platform)
          .order("scheduled_for", { ascending: false })
          .limit(1);

        let scheduledFor: Date;
        if (recentPosts && recentPosts.length > 0) {
          // Schedule after the last post + interval
          const lastPost = new Date(recentPosts[0].scheduled_for);
          scheduledFor = new Date(lastPost.getTime() + config.interval * 60 * 60 * 1000);
        } else {
          // No existing posts, schedule in 1 hour from now
          scheduledFor = new Date(now.getTime() + 60 * 60 * 1000);
        }

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
            scheduled_for: scheduledFor.toISOString(),
            status: "pending",
            metadata: {
              story_title: story.title,
              story_category: story.category,
              image_generated: generatedImageUrl ? true : false,
            },
          });

        if (insertError) {
          console.error(`[prepare-posts] Error inserting post for ${platform}:`, insertError);
          continue;
        }

        console.log(`[prepare-posts] Scheduled ${platform} post for ${scheduledFor.toISOString()}`);
        preparedCount++;
      }
    }

    console.log(`[prepare-posts] Prepared ${preparedCount} posts across all platforms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prepared ${preparedCount} posts for social media`,
        prepared: preparedCount,
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
