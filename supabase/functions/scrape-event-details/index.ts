import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventDetails {
  performer: string | null;
  event_time: string | null;
  event_date: string | null;
  venue: string | null;
  description: string | null;
}

// Extract date from URL patterns like /2025-12-09/
function extractDateFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{4}-\d{2}-\d{2})\/?(?:$|[?#])/);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, title } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[scrape-event-details] Scraping via scrape-content: ${url}`);

    // Extract date from URL first (very reliable)
    const urlDate = extractDateFromUrl(url);
    if (urlDate) {
      console.log(`📅 Found date in URL: ${urlDate}`);
    }

    // Call the centralized scrape-content function with extract_type: 'event'
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        extract_type: "event",
        use_firecrawl: true, // Allow fallback for JS-rendered pages
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error(`[scrape-event-details] scrape-content error: ${scrapeResponse.status} - ${errorText}`);
      
      // Return what we can extract from URL even if API fails
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            performer: null,
            event_time: null,
            event_date: urlDate,
            venue: null,
            description: null,
          },
          url,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeData.success) {
      console.error(`[scrape-event-details] scrape-content failed:`, scrapeData);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            performer: null,
            event_time: null,
            event_date: urlDate,
            venue: null,
            description: null,
          },
          url,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ scrape-content success for ${url} (firecrawl: ${scrapeData.used_firecrawl})`);

    const extracted = scrapeData.data || {};
    
    // Map scrape-content event schema to our expected output
    const eventDetails: EventDetails = {
      performer: extracted.performer || null,
      event_time: extracted.start_time || null,
      event_date: extracted.event_date || urlDate || null,
      venue: extracted.venue || null,
      description: extracted.description || null,
    };

    console.log(`📋 Event details extracted:`, eventDetails);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: eventDetails,
        url,
        used_firecrawl: scrapeData.used_firecrawl,
        ai_extracted: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[scrape-event-details] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
