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
  return `city-cal-${Math.abs(hash).toString(36)}`;
}

// Parse date from CivicEngage format (e.g., "December 17, 2025")
function parseCivicEngageDate(dateStr: string): string | null {
  try {
    const cleaned = dateStr.replace(/,?\s*All Day/i, '').trim();
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  return null;
}

// Extract time from string like "3:00 PM - 8:30 PM" or "All Day"
function extractTime(timeStr: string): string | null {
  if (timeStr.toLowerCase().includes('all day')) return null;
  
  const timeMatch = timeStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (timeMatch) {
    return timeMatch[1].toUpperCase();
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[sync-city-calendar] Starting sync...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch source info
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("name", "City of Lake Geneva Calendar")
      .single();

    if (sourceError || !source) {
      console.error("[sync-city-calendar] Source not found:", sourceError);
      return new Response(
        JSON.stringify({ error: "Source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the calendar page with browser-like headers to avoid 403
    console.log(`[sync-city-calendar] Fetching: ${source.url}`);
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const html = await response.text();
    console.log(`[sync-city-calendar] Fetched ${html.length} bytes`);

    // Parse events from CivicEngage HTML structure
    // The page has schema.org Event markup with itemprop="startDate" containing ISO dates
    const events: Array<{
      title: string;
      date: string;
      time: string | null;
      url: string;
      description: string;
    }> = [];

    // Pattern 1: Parse from schema.org Event markup (most reliable)
    // <li>...<a href="...EID=2305..."><span>Title</span></a>...<span itemprop="startDate">2025-12-24T00:00:00</span>...
    const schemaEventPattern = /<li>[\s\S]*?<a[^>]*href="[^"]*EID=(\d+)[^"]*"[^>]*><span>([^<]+)<\/span><\/a>[\s\S]*?<span itemprop="startDate"[^>]*>([^<]+)<\/span>/g;
    
    let match;
    while ((match = schemaEventPattern.exec(html)) !== null) {
      const [, eventId, title, startDateRaw] = match;
      const cleanTitle = title.trim();
      
      // Skip empty or short titles
      if (!cleanTitle || cleanTitle.length < 3) continue;
      
      // Parse ISO date (format: 2025-12-24T00:00:00)
      const datePart = startDateRaw.split('T')[0];
      const timePart = startDateRaw.includes('T') && !startDateRaw.includes('T00:00:00') 
        ? startDateRaw.split('T')[1]?.substring(0, 5) 
        : null;
      
      // Check if date is in the future
      const today = new Date().toISOString().split('T')[0];
      if (datePart >= today) {
        events.push({
          title: cleanTitle,
          date: datePart,
          time: timePart,
          url: `https://www.cityoflakegeneva.gov/Calendar.aspx?EID=${eventId}`,
          description: `City of Lake Geneva: ${cleanTitle}`
        });
      }
    }

    // Fallback Pattern 2: Parse from date divs if schema.org didn't work
    if (events.length === 0) {
      console.log("[sync-city-calendar] Schema.org parsing found nothing, trying fallback...");
      
      // Look for: <h3><a href="...EID=X..."><span>Title</span></a></h3>...<div class="date">December 24, 2025</div>
      const fallbackPattern = /<h3>[\s\S]*?<a[^>]*href="[^"]*EID=(\d+)[^"]*"[^>]*><span>([^<]+)<\/span><\/a>[\s\S]*?<div class="date">([^<]+)<\/div>/g;
      
      while ((match = fallbackPattern.exec(html)) !== null) {
        const [, eventId, title, dateStr] = match;
        const cleanTitle = title.trim();
        
        if (!cleanTitle || cleanTitle.length < 3) continue;
        
        // Parse date like "December&nbsp;24,&nbsp;2025,&nbsp;All Day"
        const cleanDateStr = dateStr.replace(/&nbsp;/g, ' ').replace(/,?\s*All Day/i, '').trim();
        const eventDate = parseCivicEngageDate(cleanDateStr);
        
        if (eventDate) {
          const today = new Date().toISOString().split('T')[0];
          if (eventDate >= today) {
            events.push({
              title: cleanTitle,
              date: eventDate,
              time: null,
              url: `https://www.cityoflakegeneva.gov/Calendar.aspx?EID=${eventId}`,
              description: `City of Lake Geneva: ${cleanTitle}`
            });
          }
        }
      }
    }

    console.log(`[sync-city-calendar] Found ${events.length} future events`);

    // Dedupe and insert events
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
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
            category: "civic",
            status: "auto_published", // Trusted local source
            safety_level: "safe",
            event_date: event.date,
            event_time: event.time,
            geo_tier: 1,
            geo_label: "Lake Geneva",
            metadata: {
              dedupe_key: dedupeKey,
              source_type: "city_calendar",
              scraped_at: new Date().toISOString()
            }
          });

        if (insertError) {
          errors.push(`Insert error for "${event.title}": ${insertError.message}`);
        } else {
          inserted++;
          console.log(`[sync-city-calendar] ✅ Inserted: ${event.title} (${event.date})`);
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
      message: `City calendar synced: ${inserted} inserted, ${skipped} skipped`,
      actor_type: "system",
      details: { inserted, skipped, errors: errors.slice(0, 5) }
    });

    const result = {
      success: true,
      source: "City of Lake Geneva Calendar",
      eventsFound: events.length,
      inserted,
      skipped,
      errors: errors.slice(0, 5)
    };

    console.log(`[sync-city-calendar] Complete:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[sync-city-calendar] Error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
