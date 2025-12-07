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

// Extract performer from text
function extractPerformerFromText(text: string, title?: string): string | null {
  // First try to extract from title if it follows "Live Music: Artist" pattern
  if (title) {
    const titleMatch = title.match(/live\s+music[:\s-]+(.+)/i);
    if (titleMatch) {
      const performer = titleMatch[1].trim();
      if (performer.length > 2 && performer.length < 80) {
        return performer;
      }
    }
  }
  
  // Pattern: "Live Music: Artist Name" - avoid markdown links
  const liveMusicMatch = text.match(/live\s+music[:\s-]+([^[\n\r@|]+?)(?:\s*[@\-–|]|\s*\[|\s*\n|\s*$)/i);
  if (liveMusicMatch) {
    const performer = liveMusicMatch[1].trim();
    if (performer.length > 2 && performer.length < 80 && !performer.toLowerCase().includes('every')) {
      return performer;
    }
  }
  
  // Pattern: "featuring Artist Name"
  const featMatch = text.match(/(?:featuring|feat\.?)\s+([^\n\r,@]+)/i);
  if (featMatch) {
    return featMatch[1].trim();
  }
  
  // Pattern: "with Artist Name"
  const withMatch = text.match(/\bwith\s+([A-Z][^\n\r,@]+?)(?:\s*[-–@]|\s*\n|\s*$)/i);
  if (withMatch) {
    const performer = withMatch[1].trim();
    if (performer.length > 2 && performer.length < 60) {
      return performer;
    }
  }
  
  // If title looks like a performer name (2-4 words, capitalized)
  if (title) {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allCapitalized = words.every(w => /^[A-Z]/.test(w) || /^(the|and|of|&)$/i.test(w));
      const looksLikeName = allCapitalized && 
        !title.toLowerCase().includes('live music') && 
        !title.toLowerCase().includes('event') && 
        !title.toLowerCase().includes('special') &&
        !title.toLowerCase().includes('fish fry') &&
        !title.toLowerCase().includes('ladies night');
      if (looksLikeName) {
        return title.trim();
      }
    }
  }
  
  return null;
}

// Extract time from text
function extractTimeFromText(text: string): string | null {
  // Pattern: "5:30 pm - 8:30 pm" or "5:30pm - 8:30pm" or "5:30 PM – 8:30 PM"
  const timeRangeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (timeRangeMatch) {
    return formatTimeRange(timeRangeMatch[1], timeRangeMatch[2]);
  }
  
  // Pattern: "starts at 7pm" or "@ 8:00 PM" or "time: 7pm"
  const singleTimeMatch = text.match(/(?:starts?\s+(?:at\s+)?|@\s*|time[:\s]+)(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (singleTimeMatch) {
    return normalizeTime(singleTimeMatch[1]);
  }
  
  // Generic time pattern in the first 500 chars (likely to be event time)
  const genericTimeMatch = text.substring(0, 500).match(/\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/i);
  if (genericTimeMatch) {
    return normalizeTime(genericTimeMatch[1]);
  }
  
  return null;
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

    // Extract date from URL first (very reliable)
    const urlDate = extractDateFromUrl(url);
    if (urlDate) {
      console.log(`📅 Found date in URL: ${urlDate}`);
    }

    // Use Firecrawl API directly with simpler markdown format
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl API error: ${response.status} - ${errorText}`);
      
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

    const firecrawlData = await response.json();
    
    if (!firecrawlData.success) {
      console.error(`Firecrawl failed for ${url}:`, firecrawlData);
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

    console.log(`✅ Firecrawl success for ${url}`);

    const markdown = firecrawlData.data?.markdown || "";
    
    // Extract event details from markdown
    const performer = extractPerformerFromText(markdown, title);
    const eventTime = extractTimeFromText(markdown);
    
    // Try to extract venue from metadata or markdown
    let venue = firecrawlData.data?.metadata?.ogSiteName || null;
    if (!venue) {
      const venueMatch = markdown.match(/(?:venue|location|at)\s*[:\-]\s*([^\n\r]+)/i);
      if (venueMatch) {
        venue = venueMatch[1].trim();
      }
    }
    
    // Extract description from metadata
    const description = firecrawlData.data?.metadata?.description?.substring(0, 200) || null;

    const eventDetails: EventDetails = {
      performer,
      event_time: eventTime,
      event_date: urlDate || null,
      venue,
      description,
    };

    console.log(`📋 Event details extracted:`, eventDetails);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: eventDetails,
        url,
        markdown: markdown.substring(0, 500), // Include preview for debugging
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
