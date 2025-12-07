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

// Venue keywords to filter out from performer extraction
const VENUE_KEYWORDS = [
  'pier', 'resort', 'bar', 'tap house', 'lookout', 'mansion', 'abbey', 
  'evolve', 'topsy turvy', 'hogs', 'kisses', 'grand geneva', 'lake lawn',
  'mars', 'baker house', 'maxwell', 'club', 'lounge', 'restaurant',
  'grill', 'pub', 'tavern', 'inn', 'hotel', 'casino'
];

// Garbage text patterns that should not be performers
const GARBAGE_PATTERNS = [
  'humor', 'wit', 'joyous', 'wonderful', 'amazing', 'incredible', 
  'enjoy', 'welcome', 'experience', 'celebration', 'featuring live',
  'live music', 'every', 'cocktail', 'drink', 'special', 'event'
];

// Validate that extracted performer is actually a person/band name
function isValidPerformer(performer: string, title?: string): boolean {
  if (!performer || performer.length < 2 || performer.length > 50) return false;
  
  const lower = performer.toLowerCase();
  
  // Reject if starts with venue prefix
  if (lower.startsWith('at ') || lower.startsWith('@ ') || lower.startsWith('the ')) return false;
  
  // Reject venue names
  if (VENUE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  
  // Reject garbage promotional text
  if (GARBAGE_PATTERNS.some(pattern => lower.includes(pattern))) return false;
  
  // Reject if too similar to title (likely venue/event name)
  if (title && lower === title.toLowerCase()) return false;
  
  // Reject URLs
  if (lower.includes('http') || lower.includes('www.')) return false;
  
  return true;
}

// Extract performer from text
function extractPerformerFromText(text: string, title?: string): string | null {
  // Try to extract from title patterns like "LIVE MUSIC AT THE LOOKOUT: KEVIN KENNEDY"
  if (title) {
    // Pattern: "VENUE: PERFORMER NAME"
    const colonMatch = title.match(/:\s*([^:]+?)\s*$/i);
    if (colonMatch) {
      const performer = colonMatch[1].trim();
      if (isValidPerformer(performer, title)) {
        return performer;
      }
    }
    
    // Pattern: "Live Music - Artist Name" or "Live: Artist"
    const liveMusicMatch = title.match(/live\s*(?:music)?[:\s-]+(.+)/i);
    if (liveMusicMatch) {
      const performer = liveMusicMatch[1].trim();
      // Clean up "AT VENUE: PERFORMER" pattern
      const afterColon = performer.match(/:\s*(.+)/);
      if (afterColon && isValidPerformer(afterColon[1], title)) {
        return afterColon[1].trim();
      }
      if (isValidPerformer(performer, title)) {
        return performer;
      }
    }
  }
  
  // Pattern: "Live Music: Artist Name" in body text
  const liveMusicBodyMatch = text.match(/live\s+music[:\s-]+([^[\n\r@|]+?)(?:\s*[@\-–|]|\s*\[|\s*\n|\s*$)/i);
  if (liveMusicBodyMatch) {
    const performer = liveMusicBodyMatch[1].trim();
    if (isValidPerformer(performer, title)) {
      return performer;
    }
  }
  
  // Pattern: "featuring Artist Name"
  const featMatch = text.match(/(?:featuring|feat\.?)\s+([^\n\r,@]+)/i);
  if (featMatch) {
    const performer = featMatch[1].trim();
    if (isValidPerformer(performer, title)) {
      return performer;
    }
  }
  
  // Pattern: "with Artist Name"
  const withMatch = text.match(/\bwith\s+([A-Z][^\n\r,@]+?)(?:\s*[-–@]|\s*\n|\s*$)/i);
  if (withMatch) {
    const performer = withMatch[1].trim();
    if (isValidPerformer(performer, title)) {
      return performer;
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
