import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Process N jobs from the restaurant scrape queue
// Called by cron every 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = 3 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get queued jobs, prioritized
    const { data: jobs, error: fetchError } = await supabase
      .from("restaurant_scrape_jobs")
      .select("id, source_id, restaurant_slug, retry_count, max_retries")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(batch_size);

    if (fetchError) {
      console.error("Error fetching jobs:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log("No queued jobs to process");
      return new Response(
        JSON.stringify({ success: true, message: "No jobs in queue", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${jobs.length} queued scrape jobs`);

    const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

    for (const job of jobs) {
      try {
        // Call the main scraper function for this job's source
        const response = await fetch(`${supabaseUrl}/functions/v1/scrape-restaurant-diy`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ source_id: job.source_id, max_pages: 5 }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Scraper failed for job ${job.id}:`, errorText);
          
          // Increment retry count or mark as failed
          if (job.retry_count >= job.max_retries) {
            await supabase.from("restaurant_scrape_jobs").update({
              status: "failed",
              error_message: `Max retries exceeded: ${errorText}`,
              completed_at: new Date().toISOString(),
            }).eq("id", job.id);
          } else {
            await supabase.from("restaurant_scrape_jobs").update({
              status: "queued",
              retry_count: job.retry_count + 1,
              error_message: errorText,
            }).eq("id", job.id);
          }
          
          results.push({ job_id: job.id, success: false, error: errorText });
        } else {
          const data = await response.json();
          console.log(`Job ${job.id} completed:`, data);
          results.push({ job_id: job.id, success: true });
        }

        // Small delay between jobs
        await new Promise(r => setTimeout(r, 1000));

      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err);
        results.push({ job_id: job.id, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-scrape-queue:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
