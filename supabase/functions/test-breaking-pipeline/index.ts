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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert test story with breaking classification
    const { data: story, error: storyError } = await supabase
      .from("content_queue")
      .insert({
        title: "TEST: 2 people killed in apartment fire in Lake Geneva",
        content: "This is a synthetic test story to validate the breaking news pipeline. Two people were killed in an apartment fire in downtown Lake Geneva today. Emergency responders are on scene.",
        summary: "Two people killed in Lake Geneva apartment fire. Developing story.",
        category: "public_safety",
        status: "pending",
        safety_level: "sensitive",
        is_breaking: true,
        priority_score: 9,
        publish_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (storyError) {
      throw new Error(`Failed to insert story: ${storyError.message}`);
    }

    console.log("Test story inserted:", story.id);

    // Create incident linked to the test story
    const slug = `test-fire-${Date.now()}`;
    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .insert({
        title: "TEST: 2 people killed in apartment fire in Lake Geneva",
        incident_type: "fire",
        status: "active",
        slug,
        source_story_id: story.id,
        priority_score: 9,
        location: "Downtown Lake Geneva",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (incidentError) {
      throw new Error(`Failed to create incident: ${incidentError.message}`);
    }

    console.log("Test incident created:", incident.id);

    // Add initial update to incident timeline
    const { error: updateError } = await supabase
      .from("incident_updates")
      .insert({
        incident_id: incident.id,
        text: "Initial report: Apartment fire with fatalities reported in downtown Lake Geneva. Emergency responders on scene.",
        source: "news",
        source_label: "Test Source",
        is_verified: true,
        story_id: story.id,
      });

    if (updateError) {
      console.error("Failed to add incident update:", updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        story: { id: story.id, title: story.title, is_breaking: story.is_breaking, priority_score: story.priority_score },
        incident: { id: incident.id, slug: incident.slug, status: incident.status },
        message: "Test breaking story and incident created. Check the Live Incidents sidebar on /lake-geneva page.",
        cleanup: `DELETE FROM incidents WHERE slug = '${slug}'; DELETE FROM content_queue WHERE id = '${story.id}';`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
