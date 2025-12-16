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

    // Fetch the calendar page
    console.log(`[sync-city-calendar] Fetching: ${source.url}`);
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const html = await response.text();
    console.log(`[sync-city-calendar] Fetched ${html.length} bytes`);

    // Parse events from CivicEngage HTML structure
    // Events are typically in divs with class "calitem" or similar
    const events: Array<{
      title: string;
      date: string;
      time: string | null;
      url: string;
      description: string;
    }> = [];

    // Pattern for CivicEngage calendar items
    // Look for calendar item links with dates
    const eventPattern = /<a[^>]+href="([^"]*Calendar\.aspx[^"]*eventID=\d+[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    const datePattern = /<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/gi;
    
    // More robust parsing - look for calendar event blocks
    const calItemPattern = /<div[^>]*class="[^"]*calitem[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    
    let match;
    
    // Try to find event links with their titles
    const linkMatches = [...html.matchAll(/<a[^>]+href="(\/Calendar\.aspx\?[^"]*eventID=(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/gi)];
    
    for (const linkMatch of linkMatches) {
      const eventUrl = `https://www.cityoflakegeneva.gov${linkMatch[1]}`;
      const eventId = linkMatch[2];
      const title = linkMatch[3].trim();
      
      // Skip empty titles or navigation links
      if (!title || title.length < 3 || title.toLowerCase().includes('more')) continue;
      
      // Try to find the date near this event
      // Look for date patterns in surrounding context
      const eventIndex = linkMatch.index || 0;
      const contextBefore = html.substring(Math.max(0, eventIndex - 500), eventIndex);
      const contextAfter = html.substring(eventIndex, Math.min(html.length, eventIndex + 500));
      const context = contextBefore + contextAfter;
      
      // Look for date like "December 17, 2025" or "Jan 5, 2025"
      const dateMatch = context.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
      if (dateMatch) {
        const eventDate = parseCivicEngageDate(dateMatch[1]);
        if (eventDate) {
          // Check if date is in the future
          const today = new Date().toISOString().split('T')[0];
          if (eventDate >= today) {
            // Look for time
            const timeMatch = context.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
            
            events.push({
              title,
              date: eventDate,
              time: timeMatch ? timeMatch[1].toUpperCase() : null,
              url: eventUrl,
              description: `City of Lake Geneva event: ${title}`
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
