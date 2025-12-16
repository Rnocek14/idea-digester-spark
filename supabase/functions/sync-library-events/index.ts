import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate stable dedupe key for calendar events
function generateDedupeKey(title: string, eventDate: string, eventUrl: string): string {
  const normalized = `${title.toLowerCase().trim()}|${eventDate}|${eventUrl}`.replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `library-event-${Math.abs(hash).toString(36)}`;
}

// Extract date from various formats
function extractEventDate(text: string): string | null {
  // Try ISO format first
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  
  // Try "Month Day, Year" format
  const monthDayYear = text.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
  if (monthDayYear) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    const month = months[monthDayYear[1].toLowerCase()];
    if (month) {
      const day = monthDayYear[2].padStart(2, '0');
      return `${monthDayYear[3]}-${month}-${day}`;
    }
  }
  
  // Try "Month Day" format (assume current/next year)
  const monthDay = text.match(/(\w+)\s+(\d{1,2})(?!\d)/i);
  if (monthDay) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    const month = months[monthDay[1].toLowerCase()];
    if (month) {
      const day = monthDay[2].padStart(2, '0');
      const now = new Date();
      let year = now.getFullYear();
      const testDate = new Date(`${year}-${month}-${day}`);
      if (testDate < now) year++;
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

// Extract time from text
function extractEventTime(text: string): string | null {
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] || '00';
    const period = timeMatch[3].toLowerCase();
    
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (!firecrawlKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the library source
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("name", "Lake Geneva Public Library Events")
      .single();
    
    if (sourceError || !source) {
      console.error("Library source not found:", sourceError);
      return new Response(
        JSON.stringify({ error: "Library source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔥 Scraping library calendar: ${source.url}`);

    // Call Firecrawl to scrape the JS-rendered page
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: source.url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 5000, // Wait for JS to render events
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error("Firecrawl error:", errorText);
      return new Response(
        JSON.stringify({ error: "Firecrawl scrape failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || "";
    
    console.log(`📄 Got ${markdown.length} chars of markdown`);

    // Parse events from markdown
    // Squarespace calendars typically have event blocks with title, date, time, description
    const events: Array<{
      title: string;
      event_date: string | null;
      event_time: string | null;
      description: string;
      url: string;
    }> = [];

    // Split by common event delimiters and look for event patterns
    const lines = markdown.split('\n');
    let currentEvent: { title: string; date: string | null; time: string | null; desc: string; url: string } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for event titles (usually headers or bold text)
      const headerMatch = line.match(/^#+\s*(.+)$/) || line.match(/^\*\*(.+)\*\*$/);
      if (headerMatch) {
        // Save previous event
        if (currentEvent && currentEvent.title && currentEvent.date) {
          events.push({
            title: currentEvent.title,
            event_date: currentEvent.date,
            event_time: currentEvent.time,
            description: currentEvent.desc.substring(0, 500),
            url: currentEvent.url || source.url,
          });
        }
        currentEvent = { title: headerMatch[1], date: null, time: null, desc: '', url: source.url };
        continue;
      }
      
      if (currentEvent) {
        // Look for dates
        if (!currentEvent.date) {
          const foundDate = extractEventDate(line);
          if (foundDate) {
            currentEvent.date = foundDate;
          }
        }
        
        // Look for times
        if (!currentEvent.time) {
          const foundTime = extractEventTime(line);
          if (foundTime) {
            currentEvent.time = foundTime;
          }
        }
        
        // Look for URLs
        const urlMatch = line.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
        if (urlMatch) {
          currentEvent.url = urlMatch[1];
        }
        
        // Accumulate description
        if (line && !line.startsWith('#') && !line.startsWith('*')) {
          currentEvent.desc += (currentEvent.desc ? ' ' : '') + line;
        }
      }
    }
    
    // Save last event
    if (currentEvent && currentEvent.title && currentEvent.date) {
      events.push({
        title: currentEvent.title,
        event_date: currentEvent.date,
        event_time: currentEvent.time,
        description: currentEvent.desc.substring(0, 500),
        url: currentEvent.url || source.url,
      });
    }

    console.log(`📅 Parsed ${events.length} events from calendar`);

    // Filter to future events only
    const today = new Date().toISOString().split('T')[0];
    const futureEvents = events.filter(e => e.event_date && e.event_date >= today);
    
    console.log(`📅 ${futureEvents.length} future events`);

    const results = {
      scraped: events.length,
      future: futureEvents.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const event of futureEvents) {
      try {
        const dedupeKey = generateDedupeKey(event.title, event.event_date!, event.url);
        
        // Check for existing
        const { data: existing } = await supabase
          .from("content_queue")
          .select("id")
          .eq("source_id", source.id)
          .or(`title.eq.${event.title},metadata->>dedupe_key.eq.${dedupeKey}`)
          .limit(1);
        
        if (existing && existing.length > 0) {
          results.skipped++;
          continue;
        }

        // Insert new event
        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            source_id: source.id,
            title: event.title,
            content: event.description || `Library event: ${event.title}`,
            summary: event.description?.substring(0, 200) || event.title,
            category: "events",
            original_url: event.url,
            event_date: event.event_date,
            event_time: event.event_time,
            geo_tier: 1,
            geo_label: "Lake Geneva",
            status: "auto_published", // Trusted local source
            safety_level: "safe",
            metadata: {
              dedupe_key: dedupeKey,
              venue: "Lake Geneva Public Library",
              location_tags: ["Lake Geneva"],
              trusted_locality: true,
            },
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          results.errors.push(`${event.title}: ${insertError.message}`);
        } else {
          results.inserted++;
          console.log(`✅ Inserted: ${event.title} (${event.event_date})`);
        }
      } catch (err: any) {
        results.errors.push(`${event.title}: ${err.message}`);
      }
    }

    // Update source last_fetched_at
    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "source",
      entity_id: source.id,
      action: "sync_library_events",
      message: `Library sync: ${results.inserted} new events, ${results.skipped} duplicates skipped`,
      details: results,
    });

    console.log(`🏁 Library sync complete: ${results.inserted} inserted, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Library sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
