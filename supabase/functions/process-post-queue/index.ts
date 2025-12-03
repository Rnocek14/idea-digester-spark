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

    console.log("[process-post-queue] Starting queue processing...");

    // KILL SWITCH CHECK
    const { data: settings } = await supabaseClient
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = (settings?.value as any)?.enabled !== false;
    const socialEnabled = (settings?.value as any)?.social_enabled !== false;
    
    if (!automationEnabled || !socialEnabled) {
      console.log("[process-post-queue] ⛔ Social automation is disabled via kill switch");
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
    console.log("[process-post-queue] ✅ Kill switch check passed");

    // Fetch posts that are ready to be sent
    const now = new Date();
    const { data: pendingPosts, error: fetchError } = await supabaseClient
      .from("post_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true });

    if (fetchError) {
      console.error("[process-post-queue] Error fetching posts:", fetchError);
      throw fetchError;
    }

    console.log(`[process-post-queue] Found ${pendingPosts?.length || 0} posts ready to process`);

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts ready to process",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedCount = 0;
    const results: any[] = [];

    for (const post of pendingPosts) {
      console.log(`\n[process-post-queue] ========================================`);
      console.log(`[process-post-queue] SIMULATED POST to ${post.platform.toUpperCase()}`);
      console.log(`[process-post-queue] Story ID: ${post.story_id}`);
      console.log(`[process-post-queue] Scheduled: ${post.scheduled_for}`);
      console.log(`[process-post-queue] ========================================`);
      console.log(`[process-post-queue] Content:`);
      console.log(post.post_text);
      if (post.image_url) {
        console.log(`[process-post-queue] Image: ${post.image_url}`);
      }
      console.log(`[process-post-queue] ========================================\n`);

      // SIMULATED MODE: Mark as simulated instead of actually posting
      const { error: updateError } = await supabaseClient
        .from("post_queue")
        .update({
          status: "simulated",
          sent_at: now.toISOString(),
          metadata: {
            ...post.metadata,
            simulated_at: now.toISOString(),
            simulation_note: "Would have posted to real platform API",
          },
        })
        .eq("id", post.id);

      if (updateError) {
        console.error(`[process-post-queue] Error updating post ${post.id}:`, updateError);
        results.push({
          post_id: post.id,
          platform: post.platform,
          success: false,
          error: updateError.message,
        });
        continue;
      }

      processedCount++;
      results.push({
        post_id: post.id,
        platform: post.platform,
        success: true,
        simulated: true,
      });
    }

    console.log(`[process-post-queue] Processed ${processedCount} simulated posts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Simulated ${processedCount} posts`,
        processed: processedCount,
        results,
        mode: "SIMULATED",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[process-post-queue] Error:", error);
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
