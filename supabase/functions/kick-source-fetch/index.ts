import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth - require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: hasAdmin } = await supabase.rpc("has_role", { 
      _user_id: user.id, 
      _role: "admin" 
    });

    if (!hasAdmin) {
      return new Response(
        JSON.stringify({ ok: false, error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { source_id } = await req.json();
    
    if (!source_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "source_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify source exists and is active
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("id, name, status, type, feed_url")
      .eq("id", source_id)
      .single();

    if (sourceError || !source) {
      return new Response(
        JSON.stringify({ ok: false, error: "Source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (source.status !== "active") {
      return new Response(
        JSON.stringify({ ok: false, error: `Source is ${source.status}, not active` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for recent kick (5-minute cooldown)
    const cooldownMinutes = 5;
    const { data: recentKick } = await supabase
      .from("activity_log")
      .select("created_at")
      .eq("entity_type", "source")
      .eq("entity_id", source_id)
      .eq("action", "kick_fetch")
      .gte("created_at", new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentKick) {
      const lastKickTime = new Date(recentKick.created_at);
      const minutesAgo = Math.round((Date.now() - lastKickTime.getTime()) / 60000);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Source was kicked ${minutesAgo}m ago. Please wait ${cooldownMinutes - minutesAgo}m before retrying.`,
          cooldown: true,
          lastKickAt: recentKick.created_at,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the kick action
    await supabase.from("activity_log").insert({
      entity_type: "source",
      entity_id: source_id,
      action: "kick_fetch",
      actor_type: "user",
      user_id: user.id,
      message: `Manual fetch triggered for source: ${source.name}`,
      details: { source_type: source.type, triggered_by: user.email },
    });

    // Trigger the appropriate sync function based on source type
    // For RSS/scrape sources, fire-and-forget call to sync-rss (don't block on response)
    if (source.type === "rss" || source.type === "scrape") {
      // Fire sync-rss without awaiting full response (non-blocking)
      // The sync function itself will update last_fetched_at on success
      fetch(`${supabaseUrl}/functions/v1/sync-rss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ source_id: source_id }),
      }).catch((err) => {
        // Log but don't fail - the sync is fire-and-forget
        console.warn(`sync-rss call failed for ${source_id}:`, err);
      });

      // Return immediately - don't wait for sync to complete
      // DO NOT update last_fetched_at here - only the actual sync should do that on success
      return new Response(
        JSON.stringify({ 
          ok: true, 
          source_id, 
          source_name: source.name,
          queued: true,
          message: "Fetch triggered (async)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For other source types, just mark as "kicked" and return success
    return new Response(
      JSON.stringify({ 
        ok: true, 
        source_id, 
        source_name: source.name,
        queued: true,
        message: `Source type '${source.type}' kick logged but no automatic sync available`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in kick-source-fetch:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});