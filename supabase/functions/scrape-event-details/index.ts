import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import FirecrawlApp from "https://esm.sh/@mendable/firecrawl-js@4.8.1?bundle-deps&no-dts";

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
  ticket_url: string | null;
}

// Extract date from URL patterns like /2025-12-09/ or /event/2025-12-09
function extractDateFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{4}-\d{2}-\d{2})\/?(?:$|[?#])/);
  if (match) {
    return match[1];
  }
  return null;
}

// Normalize time format to "X:XX PM" style
function normalizeTime(time: string): string {
  if (!time) return time;
  return time
    .replace(/\s+/g, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm)/gi, (_, h, m, p) => {
      const hour = h;
      const mins = m || '00';
      const period = p.toUpperCase();
      return `${hour}:${mins}${period}`;
    });
}

// Format time range consistently
function formatTimeRange(start: string, end?: string): string {
  const normalizedStart = normalizeTime(start);
  if (end) {
    const normalizedEnd = normalizeTime(end);
    return `${normalizedStart} - ${normalizedEnd}`;
  }
  return normalizedStart;
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

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔥 Firecrawl scraping: ${url}`);

    const firecrawl = new FirecrawlApp({ apiKey });

    // First, try to extract date from URL (very reliable for sites like PIER 290)
    const urlDate = extractDateFromUrl(url);
    if (urlDate) {
      console.log(`📅 Found date in URL: ${urlDate}`);
    }

    // Use Firecrawl with JSON extraction for structured event data
    const response = await firecrawl.scrape(url, {
      formats: [
        'markdown',
        {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              performer: {
                type: 'string',
                description: 'The name of the artist, band, musician, or performer. Look for names after "Live Music:", "featuring", or the main title if it appears to be a person/band name.'
              },
              event_time_start: {
                type: 'string',
                description: 'The start time of the event (e.g., "5:30 PM", "7pm", "19:00"). Look for times near the event details.'
              },
              event_time_end: {
                type: 'string',
                description: 'The end time of the event if specified (e.g., "8:30 PM", "10pm"). May not always be present.'
              },
              event_date: {
                type: 'string',
                description: 'The date of the event in YYYY-MM-DD format if found on the page.'
              },
              venue: {
                type: 'string',
                description: 'The name of the venue or location where the event takes place.'
              },
              description: {
                type: 'string',
                description: 'A brief description of the event or performer, up to 200 characters.'
              },
              ticket_url: {
                type: 'string',
                description: 'Link to purchase tickets if available.'
              }
            },
            required: ['performer']
          }
        }
      ],
      onlyMainContent: true,
      waitFor: 2000, // Wait 2 seconds for dynamic content
    });

    if (!response.success) {
      console.error(`Firecrawl failed for ${url}`);
      return new Response(
        JSON.stringify({ error: "Firecrawl scrape failed", details: response }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Firecrawl success for ${url}`);

    // Extract structured data from response
    const jsonData = response.json || {};
    
    // Build the event details with fallbacks
    const eventDetails: EventDetails = {
      performer: jsonData.performer || null,
      event_time: null,
      event_date: urlDate || jsonData.event_date || null,
      venue: jsonData.venue || null,
      description: jsonData.description || null,
      ticket_url: jsonData.ticket_url || null,
    };

    // Format the time range if we have times
    if (jsonData.event_time_start) {
      eventDetails.event_time = formatTimeRange(
        jsonData.event_time_start,
        jsonData.event_time_end
      );
    }

    // If performer not found in JSON, try to extract from title
    if (!eventDetails.performer && title) {
      const liveMusicMatch = title.match(/live\s+music[:\s-]+([^@\n\r]+?)(?:\s*[@\-–]|\s*$)/i);
      if (liveMusicMatch) {
        const performer = liveMusicMatch[1].trim();
        if (performer.length > 2 && performer.length < 80) {
          eventDetails.performer = performer;
          console.log(`🎤 Extracted performer from title: ${performer}`);
        }
      }
    }

    // Also try to find time patterns in markdown if JSON didn't capture it
    if (!eventDetails.event_time && response.markdown) {
      const markdown = response.markdown;
      
      // Pattern: "5:30 pm - 8:30 pm" or "5:30pm - 8:30pm"
      const timeRangeMatch = markdown.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
      if (timeRangeMatch) {
        eventDetails.event_time = formatTimeRange(timeRangeMatch[1], timeRangeMatch[2]);
        console.log(`⏰ Found time range in markdown: ${eventDetails.event_time}`);
      } else {
        // Single time pattern
        const singleTimeMatch = markdown.match(/(?:starts?\s+(?:at\s+)?|@\s*|time[:\s]+)(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
        if (singleTimeMatch) {
          eventDetails.event_time = normalizeTime(singleTimeMatch[1]);
          console.log(`⏰ Found single time in markdown: ${eventDetails.event_time}`);
        }
      }
    }

    console.log(`📋 Event details extracted:`, eventDetails);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: eventDetails,
        url,
        rawJson: jsonData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Scrape event details error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
