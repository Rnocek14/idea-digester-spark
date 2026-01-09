import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Patterns that indicate time-sensitive content and their expiry dates
const STALE_PATTERNS = [
  { pattern: /new\s*year'?s?\s*eve/i, validUntil: { month: 0, day: 1 } }, // Valid until Jan 1
  { pattern: /december\s*31/i, validUntil: { month: 0, day: 1 } },
  { pattern: /christmas\s*(eve)?/i, validUntil: { month: 11, day: 26 } }, // Valid until Dec 26
  { pattern: /thanksgiving/i, validUntil: { month: 10, day: 30 } }, // Valid until end of Nov
  { pattern: /halloween/i, validUntil: { month: 10, day: 1 } }, // Valid until Nov 1
  { pattern: /fourth\s*of\s*july|july\s*4th?|independence\s*day/i, validUntil: { month: 6, day: 5 } },
  { pattern: /memorial\s*day/i, validUntil: { month: 4, day: 31 } }, // Valid until end of May
  { pattern: /labor\s*day/i, validUntil: { month: 8, day: 10 } }, // Valid until Sep 10
];

function isPatternStale(pattern: { validUntil: { month: number; day: number } }): boolean {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  
  const { month, day } = pattern.validUntil;
  
  // Simple comparison: if we're past the valid date, it's stale
  if (currentMonth > month) return true;
  if (currentMonth === month && currentDay >= day) return true;
  
  // Handle year wrap (e.g., checking NYE in January)
  // If valid until is in December and we're in January, it's stale
  if (month === 11 && currentMonth < 2) return true;
  
  return false;
}

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

    const body = await req.json().catch(() => ({}));
    const { postIds, dryRun = false } = body;

    console.log("[cleanup-stale-posts] Starting cleanup...");
    console.log(`[cleanup-stale-posts] Dry run: ${dryRun}`);

    let deletedPosts: any[] = [];
    let stalePatternsFound: any[] = [];

    // If specific post IDs provided, delete those
    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      console.log(`[cleanup-stale-posts] Deleting ${postIds.length} specific posts by ID`);
      
      if (!dryRun) {
        const { data, error } = await supabaseClient
          .from("post_queue")
          .delete()
          .in("id", postIds)
          .eq("status", "pending")
          .select("id, post_text, scheduled_for");

        if (error) throw error;
        deletedPosts = data || [];
      } else {
        const { data } = await supabaseClient
          .from("post_queue")
          .select("id, post_text, scheduled_for")
          .in("id", postIds)
          .eq("status", "pending");
        deletedPosts = data || [];
      }
    }

    // Also scan for stale pattern matches in pending posts
    const { data: pendingPosts, error: fetchError } = await supabaseClient
      .from("post_queue")
      .select("id, post_text, scheduled_for, platform")
      .eq("status", "pending");

    if (fetchError) throw fetchError;

    for (const post of pendingPosts || []) {
      for (const stalePattern of STALE_PATTERNS) {
        if (stalePattern.pattern.test(post.post_text) && isPatternStale(stalePattern)) {
          stalePatternsFound.push({
            id: post.id,
            preview: post.post_text?.substring(0, 80) + "...",
            pattern: stalePattern.pattern.toString(),
            scheduled_for: post.scheduled_for,
            platform: post.platform,
          });
          break; // Don't double-count
        }
      }
    }

    // Delete stale pattern matches (if not already deleted by ID)
    const staleIds = stalePatternsFound
      .map(p => p.id)
      .filter(id => !postIds?.includes(id));

    if (staleIds.length > 0 && !dryRun) {
      const { error: deleteError } = await supabaseClient
        .from("post_queue")
        .delete()
        .in("id", staleIds);

      if (deleteError) throw deleteError;
      console.log(`[cleanup-stale-posts] Deleted ${staleIds.length} posts with stale patterns`);
    }

    const totalDeleted = dryRun ? 0 : deletedPosts.length + staleIds.length;

    // Log activity
    if (totalDeleted > 0) {
      await supabaseClient.from("activity_log").insert({
        actor_type: "system",
        entity_type: "social",
        action: "cleanup_stale",
        message: `Cleaned up ${totalDeleted} stale posts`,
        details: {
          deleted_by_id: deletedPosts.length,
          deleted_by_pattern: staleIds.length,
          patterns_found: stalePatternsFound.map(p => p.pattern),
        },
      });
    }

    const result = {
      success: true,
      dry_run: dryRun,
      deleted_by_id: dryRun ? deletedPosts : deletedPosts.length,
      stale_patterns_found: stalePatternsFound,
      stale_patterns_deleted: dryRun ? 0 : staleIds.length,
      total_deleted: totalDeleted,
    };

    console.log("[cleanup-stale-posts] Complete:", JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cleanup-stale-posts] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
