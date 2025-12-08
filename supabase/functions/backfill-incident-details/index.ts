import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { limit = 10, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[backfill-incident-details] Starting backfill (limit: ${limit}, dry_run: ${dry_run})`);

    // Find incidents with NULL location that have a source_story_id
    const { data: incidents, error: fetchError } = await supabase
      .from("incidents")
      .select(`
        id,
        title,
        location,
        source_story_id
      `)
      .is("location", null)
      .not("source_story_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error("[backfill-incident-details] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[backfill-incident-details] Found ${incidents?.length || 0} incidents to process`);

    const results: any[] = [];

    for (const incident of incidents || []) {
      // Fetch the story details separately
      const { data: story } = await supabase
        .from("content_queue")
        .select("id, original_url, title")
        .eq("id", incident.source_story_id)
        .single();
        
      if (!story?.original_url) {
        console.log(`[backfill-incident-details] Skipping incident ${incident.id} - no original URL`);
        results.push({ id: incident.id, status: "skipped", reason: "no_url" });
        continue;
      }

      console.log(`[backfill-incident-details] Processing incident ${incident.id}: ${incident.title}`);

      if (dry_run) {
        results.push({ id: incident.id, url: story.original_url, status: "would_process" });
        continue;
      }

      try {
        // Call the scrape-incident-details function
        const response = await fetch(`${supabaseUrl}/functions/v1/scrape-incident-details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            url: story.original_url,
            title: story.title || incident.title,
            incident_id: incident.id,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          results.push({
            id: incident.id,
            status: "success",
            location: result.details?.location,
            severity: result.details?.severity,
          });
        } else {
          results.push({ id: incident.id, status: "error", error: result.error });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error: any) {
        console.error(`[backfill-incident-details] Error processing ${incident.id}:`, error);
        results.push({ id: incident.id, status: "error", error: error.message });
      }
    }

    const summary = {
      total: incidents?.length || 0,
      processed: results.filter(r => r.status === "success").length,
      skipped: results.filter(r => r.status === "skipped").length,
      errors: results.filter(r => r.status === "error").length,
      dry_run,
    };

    console.log("[backfill-incident-details] Summary:", summary);

    // Log activity
    if (!dry_run) {
      await supabase.from("activity_log").insert({
        actor_type: "system",
        entity_type: "incident",
        action: "backfill_details",
        message: `Backfilled incident details: ${summary.processed} processed, ${summary.errors} errors`,
        details: { summary, results },
      });
    }

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[backfill-incident-details] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
