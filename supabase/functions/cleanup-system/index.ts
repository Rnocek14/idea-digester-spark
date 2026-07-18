import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action } = await req.json().catch(() => ({}));
    const results: Record<string, unknown> = { action };

    switch (action) {
      case "expire_stale_newsletters": {
        // Mark old 'ready' newsletters as expired
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data, error } = await supabase
          .from("newsletters")
          .update({ status: "expired" })
          .eq("status", "ready")
          .lt("created_at", sevenDaysAgo.toISOString())
          .select("id, subject, edition_date");
        
        if (error) throw error;
        results.expired_newsletters = data?.length || 0;
        results.newsletters = data;
        break;
      }

      case "disable_broken_sources": {
        // Mark sources with error status as inactive
        const { data, error } = await supabase
          .from("sources")
          .update({ status: "inactive" })
          .eq("status", "error")
          .select("id, name");
        
        if (error) throw error;
        results.disabled_sources = data?.length || 0;
        results.sources = data;
        break;
      }

      case "full_cleanup": {
        // Run all cleanup tasks
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 1. Expire stale newsletters
        const { data: newsletters, error: nlError } = await supabase
          .from("newsletters")
          .update({ status: "expired" })
          .eq("status", "ready")
          .lt("created_at", sevenDaysAgo.toISOString())
          .select("id, subject");
        
        if (nlError) console.error("Newsletter cleanup error:", nlError);
        results.expired_newsletters = newsletters?.length || 0;

        // 2. Disable broken sources
        const { data: sources, error: srcError } = await supabase
          .from("sources")
          .update({ status: "inactive" })
          .eq("status", "error")
          .select("id, name");
        
        if (srcError) console.error("Source cleanup error:", srcError);
        results.disabled_sources = sources?.length || 0;
        results.sources = sources?.map(s => s.name);

        // Log activity
        await supabase.from("activity_log").insert({
          actor_type: "system",
          entity_type: "system",
          action: "cleanup",
          message: `System cleanup: ${newsletters?.length || 0} newsletters expired, ${sources?.length || 0} sources disabled`,
          details: results,
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: "Unknown action", 
            available: ["expire_stale_newsletters", "disable_broken_sources", "full_cleanup"] 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("[cleanup-system] Completed:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cleanup-system] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
