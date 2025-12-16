import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate stable dedupe key
function generateDedupeKey(title: string, eventDate: string, eventUrl: string): string {
  const input = `${title.toLowerCase().trim()}|${eventDate}|${eventUrl}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `downtown-${Math.abs(hash).toString(36)}`;
}

// Parse short date formats like "Thu, Dec 18" or "Fri, Nov 28"
function parseShortDate(dateStr: string): string | null {
  try {
    // Handle formats like "Thu, Dec 18", "Dec 18", "Fri, Nov 28"
    const match = dateStr.match(/([A-Za-z]+),?\s*([A-Za-z]+)\s+(\d{1,2})/);
    if (match) {
      const monthStr = match[2];
      const day = parseInt(match[3], 10);
      
      // Parse month
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const month = months[monthStr.toLowerCase().substring(0, 3)];
      if (month === undefined) return null;
      
      // Infer year - if month is in the past, use next year
      const now = new Date();
      let year = now.getFullYear();
      const testDate = new Date(year, month, day);
      if (testDate < now) {
        year++;
      }
      
      return new Date(year, month, day).toISOString().split('T')[0];
    }
    
    // Try full date format "December 18, 2025"
    const fullMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?/);
    if (fullMatch) {
      const monthStr = fullMatch[1];
      const day = parseInt(fullMatch[2], 10);
      const year = fullMatch[3] ? parseInt(fullMatch[3], 10) : new Date().getFullYear();
      
      const parsed = new Date(`${monthStr} ${day}, ${year}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  } catch {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  return null;
}

// Extract date from URL slug like "santa-visits-downtown-2025-12-18-17-00"
function extractDateFromUrl(url: string): string | null {
  // Pattern: YYYY-MM-DD in URL
  const match = url.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[sync-downtown-events] Starting sync...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch source info
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("name", "Downtown Lake Geneva Events")
      .single();

    if (sourceError || !source) {
      console.error("[sync-downtown-events] Source not found:", sourceError);
      return new Response(
        JSON.stringify({ error: "Source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the events page
    console.log(`[sync-downtown-events] Fetching: ${source.url}`);
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events page: ${response.status}`);
    }

    const html = await response.text();
    console.log(`[sync-downtown-events] Fetched ${html.length} bytes`);

    // Parse events from Wix HTML
    const events: Array<{
      title: string;
      date: string;
      time: string | null;
      url: string;
      description: string;
    }> = [];

    // Wix event pattern: link to /event-details/ with title, followed by date
    // Example: [Santa Visits Downtown!](https://www.downtownlakegeneva.org/event-details/santa-visits-downtown-2025-12-18-17-00)
    // with nearby "Thu, Dec 18"
    
    // Find all event detail links
    const eventLinkPattern = /href="(https?:\/\/www\.downtownlakegeneva\.org\/event-details\/[^"]+)"[^>]*>([^<]+)</gi;
    const linkMatches = [...html.matchAll(eventLinkPattern)];
    
    console.log(`[sync-downtown-events] Found ${linkMatches.length} event links`);
    
    for (const match of linkMatches) {
      const eventUrl = match[1];
      let title = match[2].trim();
      
      // Skip navigation/button text
      if (!title || title.length < 3 || 
          title.toLowerCase() === 'more info' || 
          title.toLowerCase().includes('buy ticket') ||
          title.toLowerCase() === 'read more') {
        continue;
      }
      
      // Try to extract date from URL first (most reliable for Wix)
      let eventDate = extractDateFromUrl(eventUrl);
      
      // If no date in URL, look in surrounding HTML
      if (!eventDate) {
        const matchIndex = match.index || 0;
        const context = html.substring(matchIndex, Math.min(html.length, matchIndex + 1000));
        
        // Look for short date like "Thu, Dec 18" or "Fri, Nov 28"
        const dateMatch = context.match(/([A-Za-z]{3,9}),?\s*([A-Za-z]{3,9})\s+(\d{1,2})/);
        if (dateMatch) {
          eventDate = parseShortDate(dateMatch[0]);
        }
      }
      
      if (!eventDate) {
        console.log(`[sync-downtown-events] No date found for: ${title}`);
        continue;
      }
      
      // Check if date is in the future
      const today = new Date().toISOString().split('T')[0];
      if (eventDate < today) {
        console.log(`[sync-downtown-events] Past event skipped: ${title} (${eventDate})`);
        continue;
      }
      
      // Extract time from URL if present (format: 2025-12-18-17-00 = 5:00 PM)
      let time: string | null = null;
      const timeMatch = eventUrl.match(/\d{4}-\d{2}-\d{2}-(\d{2})-(\d{2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2];
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        time = `${hour12}:${minute} ${period}`;
      }
      
      events.push({
        title,
        date: eventDate,
        time,
        url: eventUrl,
        description: `Downtown Lake Geneva event: ${title}`
      });
    }

    // Dedupe events by title+date
    const uniqueEvents = events.filter((event, index, self) =>
      index === self.findIndex(e => 
        e.title.toLowerCase() === event.title.toLowerCase() && e.date === event.date
      )
    );

    console.log(`[sync-downtown-events] Found ${uniqueEvents.length} unique future events`);

    // Insert events
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of uniqueEvents) {
      try {
        const dedupeKey = generateDedupeKey(event.title, event.date, event.url);
        
        // Check for existing
        const { data: existing } = await supabase
          .from("content_queue")
          .select("id")
          .eq("metadata->>dedupe_key", dedupeKey)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert new event
        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            source_id: source.id,
            title: event.title,
            content: event.description,
            original_url: event.url,
            category: "events",
            status: "auto_published",
            safety_level: "safe",
            event_date: event.date,
            event_time: event.time,
            geo_tier: 1,
            geo_label: "Lake Geneva",
            metadata: {
              dedupe_key: dedupeKey,
              source_type: "downtown_events",
              location: "Downtown Lake Geneva",
              scraped_at: new Date().toISOString()
            }
          });

        if (insertError) {
          errors.push(`Insert error for "${event.title}": ${insertError.message}`);
        } else {
          inserted++;
          console.log(`[sync-downtown-events] ✅ Inserted: ${event.title} (${event.date})`);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        errors.push(`Error processing "${event.title}": ${errorMsg}`);
      }
    }

    // Update last_fetched_at
    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "source",
      entity_id: source.id,
      action: "synced",
      message: `Downtown events synced: ${inserted} inserted, ${skipped} skipped`,
      actor_type: "system",
      details: { inserted, skipped, errors: errors.slice(0, 5) }
    });

    const result = {
      success: true,
      source: "Downtown Lake Geneva Events",
      eventsFound: uniqueEvents.length,
      inserted,
      skipped,
      errors: errors.slice(0, 5)
    };

    console.log(`[sync-downtown-events] Complete:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[sync-downtown-events] Error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
