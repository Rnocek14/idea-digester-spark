import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log("[cleanup-bad-schedules] Starting cleanup of badly-scheduled posts...");

    // Fetch all pending X posts
    const { data: pendingPosts, error: fetchError } = await supabaseClient
      .from("post_queue")
      .select("id, story_id, scheduled_for, post_text")
      .eq("platform", "x")
      .eq("status", "pending");

    if (fetchError) throw fetchError;

    // Optimal posting hours in Central Time
    const OPTIMAL_SLOTS = [8, 10, 12, 14, 16, 18];
    
    // Filter to find posts scheduled outside optimal times:
    // 1. Outside 7am-9pm Central window
    // 2. Not at an optimal hour slot (8, 10, 12, 14, 16, 18)
    // 3. Not at the top of the hour (minute != 0)
    const badPosts = (pendingPosts || []).filter(post => {
      const scheduledDate = new Date(post.scheduled_for);
      const centralTime = new Date(scheduledDate.toLocaleString("en-US", { timeZone: "America/Chicago" }));
      const hour = centralTime.getHours();
      const minute = centralTime.getMinutes();
      
      // Outside posting window
      if (hour < 7 || hour >= 21) return true;
      
      // Not at optimal hour slot OR not at top of hour
      if (!OPTIMAL_SLOTS.includes(hour) || minute !== 0) return true;
      
      return false;
    });

    console.log(`[cleanup-bad-schedules] Found ${badPosts.length} posts scheduled outside 7am-9pm Central`);

    if (badPosts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No bad schedules found", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the story IDs before deletion (for re-queueing)
    const storyIds = [...new Set(badPosts.map(p => p.story_id))];
    const postIds = badPosts.map(p => p.id);

    // Delete the bad posts
    const { error: deleteError } = await supabaseClient
      .from("post_queue")
      .delete()
      .in("id", postIds);

    if (deleteError) throw deleteError;

    console.log(`[cleanup-bad-schedules] ✅ Deleted ${postIds.length} badly-scheduled posts`);
    console.log(`[cleanup-bad-schedules] Affected stories: ${storyIds.length}`);

    // Log some examples of what was deleted
    const examples = badPosts.slice(0, 5).map(p => ({
      id: p.id,
      preview: p.post_text?.substring(0, 50) + "...",
      scheduled_for: p.scheduled_for
    }));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${postIds.length} badly-scheduled posts. Run prepare-posts to reschedule them at optimal times.`,
        deleted: postIds.length,
        affected_stories: storyIds.length,
        examples
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cleanup-bad-schedules] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
