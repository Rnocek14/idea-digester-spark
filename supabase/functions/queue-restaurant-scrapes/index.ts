import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Queue all active restaurant sources for scraping
// This creates jobs that will be processed by process-scrape-queue

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force_all = false } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active restaurant sources
    const { data: sources, error: fetchError } = await supabase
      .from("sources")
      .select("id, name, url, last_fetched_at, metadata")
      .eq("category", "restaurant")
      .eq("status", "active");

    if (fetchError) {
      console.error("Error fetching sources:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No restaurant sources found", queued: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter to sources that need scraping (not scraped in last week, or force_all)
    const sourcesToQueue = sources.filter(source => {
      if (force_all) return true;
      if (!source.last_fetched_at) return true;
      return new Date(source.last_fetched_at) < oneWeekAgo;
    });

    console.log(`Queueing ${sourcesToQueue.length} of ${sources.length} restaurant sources for scraping`);

    // Create jobs for each source
    const jobs = sourcesToQueue.map((source, index) => ({
      source_id: source.id,
      restaurant_slug: source.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").substring(0, 50),
      status: "queued",
      priority: index, // First sources get higher priority
      retry_count: 0,
      max_retries: 3,
    }));

    // Upsert jobs (update if already exists for this source)
    const { data: insertedJobs, error: insertError } = await supabase
      .from("restaurant_scrape_jobs")
      .upsert(jobs, { 
        onConflict: "source_id",
        ignoreDuplicates: false,
      })
      .select();

    if (insertError) {
      console.error("Error creating jobs:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "queue_restaurant_scrapes",
      entity_type: "restaurant_scrape_jobs",
      actor_type: "system",
      details: {
        total_sources: sources.length,
        queued: sourcesToQueue.length,
        force_all,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_sources: sources.length,
        queued: sourcesToQueue.length,
        jobs: insertedJobs?.map(j => ({ id: j.id, source_id: j.source_id })) || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in queue-restaurant-scrapes:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
