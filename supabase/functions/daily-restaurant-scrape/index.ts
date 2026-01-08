import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily scheduled function to scrape all restaurant sources and sync dining content
// Schedule: Runs daily at 6 AM CT (11:00 UTC)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: {
    scraper: { success: boolean; restaurants_processed: number; error?: string };
    sync: { success: boolean; synced: number; error?: string };
  } = {
    scraper: { success: false, restaurants_processed: 0 },
    sync: { success: false, synced: 0 },
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting daily restaurant scrape workflow...");

    // Step 1: Run the restaurant DIY scraper on all sources
    console.log("Step 1: Running scrape-restaurant-diy...");
    
    try {
      const scraperResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-restaurant-diy`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          limit: 50, // Process up to 50 restaurants
          max_pages: 5 // Max pages per restaurant
        }),
      });

      if (!scraperResponse.ok) {
        const errorText = await scraperResponse.text();
        console.error("Scraper failed:", errorText);
        results.scraper.error = errorText;
      } else {
        const scraperData = await scraperResponse.json();
        console.log("Scraper completed:", scraperData);
        results.scraper.success = true;
        results.scraper.restaurants_processed = scraperData.processed || 0;
      }
    } catch (scraperError) {
      console.error("Scraper error:", scraperError);
      results.scraper.error = String(scraperError);
    }

    // Wait a moment before syncing
    await new Promise(r => setTimeout(r, 2000));

    // Step 2: Sync dining content to content queue
    console.log("Step 2: Running sync-dining-content-v2...");
    
    try {
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-dining-content-v2`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        console.error("Sync failed:", errorText);
        results.sync.error = errorText;
      } else {
        const syncData = await syncResponse.json();
        console.log("Sync completed:", syncData);
        results.sync.success = true;
        results.sync.synced = syncData.synced || 0;
      }
    } catch (syncError) {
      console.error("Sync error:", syncError);
      results.sync.error = String(syncError);
    }

    const duration = Date.now() - startTime;

    // Log activity
    await supabase.from("activity_log").insert({
      action: "daily_restaurant_scrape",
      entity_type: "restaurants",
      actor_type: "system",
      details: {
        duration_ms: duration,
        scraper_success: results.scraper.success,
        restaurants_processed: results.scraper.restaurants_processed,
        sync_success: results.sync.success,
        content_synced: results.sync.synced,
      },
    });

    console.log(`Daily restaurant scrape completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: results.scraper.success || results.sync.success,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in daily-restaurant-scrape:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
