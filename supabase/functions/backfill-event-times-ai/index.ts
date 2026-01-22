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

  console.log("[backfill-event-times-ai] Starting...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse request body for optional limit
  let limit = 10;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(body.limit, 25);
  } catch {
    // Use default limit
  }

  try {
    // Find events missing event_time with valid URLs
    const { data: events, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, original_url, content, event_date")
      .eq("category", "events")
      .is("event_time", null)
      .not("original_url", "is", null)
      .gte("event_date", new Date().toISOString().split('T')[0])
      .order("event_date", { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch events: ${fetchError.message}`);
    }

    console.log(`[backfill-event-times-ai] Found ${events?.length || 0} events to process`);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, updated: 0, message: "No events need time extraction" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let errors: string[] = [];

    for (const event of events) {
      try {
        console.log(`[backfill-event-times-ai] Processing: ${event.title}`);
        
        let pageContent = event.content || "";
        
        // Try to scrape the page for more content
        if (event.original_url) {
          let scraped = false;
          
          // Try Firecrawl first if available
          if (firecrawlKey && !scraped) {
            try {
              const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${firecrawlKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: event.original_url,
                  formats: ["markdown"],
                  onlyMainContent: true,
                  waitFor: 2000,
                }),
              });

              if (scrapeResponse.ok) {
                const scrapeData = await scrapeResponse.json();
                const markdown = scrapeData.data?.markdown || scrapeData.markdown;
                if (markdown && markdown.length > 50) {
                  pageContent = markdown;
                  scraped = true;
                  console.log(`  ✓ Firecrawl: ${markdown.length} chars`);
                }
              } else {
                console.log(`  ⚠️ Firecrawl: ${scrapeResponse.status}`);
              }
            } catch (scrapeErr) {
              console.log(`  ⚠️ Firecrawl error: ${scrapeErr}`);
            }
          }
          
          // Fallback: try static fetch
          if (!scraped) {
            try {
              const staticResponse = await fetch(event.original_url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  "Accept": "text/html,application/xhtml+xml",
                },
              });
              
              if (staticResponse.ok) {
                const html = await staticResponse.text();
                // Extract text content (simple extraction)
                const textContent = html
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (textContent.length > 100) {
                  pageContent = textContent.substring(0, 5000);
                  scraped = true;
                  console.log(`  ✓ Static fetch: ${textContent.length} chars`);
                }
              }
            } catch (staticErr) {
              console.log(`  ⚠️ Static fetch failed`);
            }
          }
        }

        // Skip if we have no content to analyze
        if (!pageContent || pageContent.length < 20) {
          console.log(`  ⏭️ Skipping - no content available`);
          continue;
        }

        // Use OpenAI to extract event time
        if (!openaiKey) {
          console.log(`  ⚠️ No OpenAI key, skipping AI extraction`);
          continue;
        }

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an event time extractor. Extract the start time of an event from the provided content.

Return ONLY the time in format like "7:00 PM" or "6:30 PM" or "12:00 PM".
If there's a time range, return just the START time.
If no specific time is found, return "null".
Do not include any other text or explanation.`
              },
              {
                role: "user",
                content: `Event title: ${event.title}\nEvent date: ${event.event_date}\n\nPage content:\n${pageContent.substring(0, 3000)}`
              }
            ],
            max_tokens: 20,
            temperature: 0,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.log(`  ⚠️ OpenAI error: ${aiResponse.status} - ${errText}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const extractedTime = aiData.choices?.[0]?.message?.content?.trim();

        console.log(`  → AI extracted: "${extractedTime}"`);

        // Validate the extracted time
        if (!extractedTime || extractedTime === "null" || extractedTime.length > 20) {
          console.log(`  ⏭️ No valid time extracted`);
          continue;
        }

        // Verify it looks like a time format
        if (!/\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(extractedTime) && 
            !/\d{1,2}\s*(AM|PM|am|pm)/i.test(extractedTime)) {
          console.log(`  ⏭️ Invalid time format: ${extractedTime}`);
          continue;
        }

        // Update the event
        const { error: updateError } = await supabase
          .from("content_queue")
          .update({ 
            event_time: extractedTime.toUpperCase().replace(/\s/g, ''),
            metadata: {
              ...((event as any).metadata || {}),
              time_extracted_by: "ai_backfill",
              time_extracted_at: new Date().toISOString()
            }
          })
          .eq("id", event.id);

        if (updateError) {
          errors.push(`Update failed for ${event.id}: ${updateError.message}`);
          continue;
        }

        updated++;
        console.log(`  ✅ Updated with time: ${extractedTime}`);

      } catch (eventError) {
        const msg = eventError instanceof Error ? eventError.message : String(eventError);
        errors.push(`Error processing ${event.id}: ${msg}`);
        console.error(`  ❌ Error: ${msg}`);
      }
    }

    const result = {
      success: true,
      processed: events.length,
      updated,
      errors: errors.slice(0, 5),
    };

    console.log(`[backfill-event-times-ai] Complete:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[backfill-event-times-ai] Error:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
