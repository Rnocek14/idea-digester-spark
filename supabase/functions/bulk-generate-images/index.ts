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
    const { limit = 3 } = await req.json().catch(() => ({}));
    // Cap at 5 max to stay under 150s edge function timeout (~25s per image)
    const safeBatchSize = Math.min(limit, 5);
    
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

    console.log(`[bulk-generate-images] Starting bulk image generation (requested: ${limit}, using: ${safeBatchSize})...`);

    // Fetch stories missing images (regardless of status - process all safe stories)
    const { data: storiesNeedingImages, error: fetchError } = await supabaseClient
      .from("content_queue")
      .select("*")
      .eq("safety_level", "safe")
      .not("content_instagram", "is", null)
      .is("image_url", null)
      .limit(safeBatchSize);

    if (fetchError) {
      console.error("[bulk-generate-images] Error fetching stories:", fetchError);
      throw fetchError;
    }

    console.log(`[bulk-generate-images] Found ${storiesNeedingImages?.length || 0} stories needing images`);

    if (!storiesNeedingImages || storiesNeedingImages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No stories need image generation",
          generated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const story of storiesNeedingImages) {
      console.log(`[bulk-generate-images] Generating image for story: ${story.title}`);
      
      try {
        const { data: aiImageData, error: aiError } = await supabaseClient.functions.invoke(
          'generate-post-image',
          {
            body: { story_id: story.id, platform: 'instagram' }
          }
        );

        if (aiError) {
          console.error(`[bulk-generate-images] Failed for story ${story.id}:`, aiError);
          errorCount++;
          results.push({
            story_id: story.id,
            title: story.title,
            success: false,
            error: aiError.message,
          });
          continue;
        }

        if (aiImageData?.image_url) {
          // Update the story with the generated image
          const { error: updateError } = await supabaseClient
            .from("content_queue")
            .update({
              image_url: aiImageData.image_url,
              image_source: 'AI',
            })
            .eq("id", story.id);

          if (updateError) {
            console.error(`[bulk-generate-images] Failed to update story ${story.id}:`, updateError);
            errorCount++;
            results.push({
              story_id: story.id,
              title: story.title,
              success: false,
              error: updateError.message,
            });
          } else {
            console.log(`[bulk-generate-images] Successfully generated image for ${story.id}`);
            successCount++;
            results.push({
              story_id: story.id,
              title: story.title,
              success: true,
              image_url: aiImageData.image_url,
            });
          }
        } else {
          console.error(`[bulk-generate-images] No image URL returned for story ${story.id}`);
          errorCount++;
          results.push({
            story_id: story.id,
            title: story.title,
            success: false,
            error: "No image URL returned",
          });
        }
      } catch (err) {
        console.error(`[bulk-generate-images] Exception for story ${story.id}:`, err);
        errorCount++;
        results.push({
          story_id: story.id,
          title: story.title,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(`[bulk-generate-images] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${successCount} images (${errorCount} errors)`,
        generated: successCount,
        errors: errorCount,
        total: storiesNeedingImages.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[bulk-generate-images] Error:", error);
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
