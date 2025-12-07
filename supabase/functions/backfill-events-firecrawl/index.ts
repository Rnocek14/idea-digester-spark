import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract date from URL patterns like /2025-12-09/
function extractDateFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{4}-\d{2}-\d{2})\/?(?:$|[?#])/);
  if (match) {
    return match[1];
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 20, use_firecrawl = true } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find events missing performer or event_time, prioritizing nightlife
    const { data: events, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, original_url, performer, event_time, event_date, metadata")
      .eq("category", "events")
      .or("performer.is.null,event_time.is.null,event_date.is.null")
      .not("original_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error("Error fetching events:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${events?.length || 0} events to backfill`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const event of events || []) {
      results.processed++;
      
      try {
        let performer = event.performer;
        let eventTime = event.event_time;
        let eventDate = event.event_date;
        let updated = false;

        // First, try to extract date from URL (fast, no API call)
        if (!eventDate && event.original_url) {
          const urlDate = extractDateFromUrl(event.original_url);
          if (urlDate) {
            eventDate = urlDate;
            console.log(`📅 Extracted date from URL for "${event.title}": ${urlDate}`);
          }
        }

        // If we still need performer or time, use Firecrawl
        if (use_firecrawl && (!performer || !eventTime)) {
          console.log(`🔥 Calling Firecrawl for "${event.title}"...`);
          
          // Call our scrape-event-details function
          const scrapeResponse = await fetch(
            `${supabaseUrl}/functions/v1/scrape-event-details`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                url: event.original_url,
                title: event.title,
              }),
            }
          );

          if (scrapeResponse.ok) {
            const scrapeResult = await scrapeResponse.json();
            
            if (scrapeResult.success && scrapeResult.data) {
              const data = scrapeResult.data;
              
              if (!performer && data.performer) {
                performer = data.performer;
                console.log(`🎤 Got performer: ${performer}`);
              }
              
              if (!eventTime && data.event_time) {
                eventTime = data.event_time;
                console.log(`⏰ Got time: ${eventTime}`);
              }
              
              if (!eventDate && data.event_date) {
                eventDate = data.event_date;
                console.log(`📅 Got date: ${eventDate}`);
              }
            }
          } else {
            console.warn(`Firecrawl failed for ${event.original_url}`);
          }

          // Add a small delay between Firecrawl calls to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Update if we found new data
        if (performer !== event.performer || eventTime !== event.event_time || eventDate !== event.event_date) {
          const updateData: any = {};
          if (performer && !event.performer) updateData.performer = performer;
          if (eventTime && !event.event_time) updateData.event_time = eventTime;
          if (eventDate && !event.event_date) updateData.event_date = eventDate;

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from("content_queue")
              .update(updateData)
              .eq("id", event.id);

            if (updateError) {
              console.error(`Update error for ${event.id}:`, updateError);
              results.errors.push(`Update failed for "${event.title}": ${updateError.message}`);
            } else {
              results.updated++;
              updated = true;
              console.log(`✅ Updated "${event.title}" with:`, updateData);
            }
          }
        }

        if (!updated) {
          results.skipped++;
        }

        results.details.push({
          id: event.id,
          title: event.title.substring(0, 50),
          performer,
          eventTime,
          eventDate,
          updated,
        });

      } catch (error: any) {
        console.error(`Error processing event ${event.id}:`, error);
        results.errors.push(`${event.title}: ${error.message}`);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "content",
      action: "backfill_events_firecrawl",
      message: `Backfilled ${results.updated} events with Firecrawl (${results.processed} processed, ${results.skipped} skipped)`,
      details: {
        processed: results.processed,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
      },
    });

    console.log(`Backfill complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
