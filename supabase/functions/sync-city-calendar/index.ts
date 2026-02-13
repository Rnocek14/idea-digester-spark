import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Detect if HTML is a bot challenge page
function detectChallenge(content: string): boolean {
  const markers = ["cloudflare", "captcha", "attention required", "enable javascript", "just a moment", "checking your browser", "cf-browser-verification"];
  const lower = content.substring(0, 5000).toLowerCase();
  return markers.some(m => lower.includes(m));
}

// Update source fetch health in DB
async function updateSourceHealth(
  supabase: any,
  sourceId: string,
  success: boolean,
  errorCode?: string,
  errorDetail?: string,
) {
  const update: Record<string, any> = { last_fetched_at: new Date().toISOString() };
  if (success) {
    update.last_successful_fetch_at = new Date().toISOString();
    update.last_error_code = null;
    update.last_error_detail = null;
  } else {
    update.last_error_code = errorCode || "unknown";
    update.last_error_detail = (errorDetail || "").substring(0, 500);
  }
  await supabase.from("sources").update(update).eq("id", sourceId);
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[sync-city-calendar] Starting sync...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      }
    });

    const fetchStatusCode = response.status;
    const fetchContentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      await updateSourceHealth(supabase, source.id, false, `http_${fetchStatusCode}`, `HTTP ${fetchStatusCode} from ${source.url}`);
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const html = await response.text();
    const containsChallenge = detectChallenge(html);

    // Log fetch health
    console.log(`[sync-city-calendar] 📊 Fetch health: status=${fetchStatusCode} content_type=${fetchContentType} length=${html.length} challenge=${containsChallenge}`);

    if (containsChallenge) {
      await updateSourceHealth(supabase, source.id, false, "blocked", "Bot challenge/Cloudflare page detected");
      return new Response(
        JSON.stringify({ error: "Blocked by bot challenge", fetch_health: { status_code: fetchStatusCode, contains_challenge: true } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-city-calendar] Fetched ${html.length} bytes`);

    // Parse events from CivicEngage HTML structure
    const events: Array<{
      title: string;
      date: string;
      time: string | null;
      url: string;
      description: string;
    }> = [];

    // Pattern 1: schema.org Event markup
    const schemaEventPattern = /<li>[\s\S]*?<a[^>]*href="[^"]*EID=(\d+)[^"]*"[^>]*><span>([^<]+)<\/span><\/a>[\s\S]*?<span itemprop="startDate"[^>]*>([^<]+)<\/span>/g;
    
    let match;
    while ((match = schemaEventPattern.exec(html)) !== null) {
      const [, eventId, title, startDateRaw] = match;
      const cleanTitle = title.trim();
      if (!cleanTitle || cleanTitle.length < 3) continue;
      
      const datePart = startDateRaw.split('T')[0];
      const timePart = startDateRaw.includes('T') && !startDateRaw.includes('T00:00:00') 
        ? startDateRaw.split('T')[1]?.substring(0, 5) 
        : null;
      
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

    // Fallback Pattern 2
    if (events.length === 0) {
      console.log("[sync-city-calendar] Schema.org parsing found nothing, trying fallback...");
      
      const fallbackPattern = /<h3>[\s\S]*?<a[^>]*href="[^"]*EID=(\d+)[^"]*"[^>]*><span>([^<]+)<\/span><\/a>[\s\S]*?<div class="date">([^<]+)<\/div>/g;
      
      while ((match = fallbackPattern.exec(html)) !== null) {
        const [, eventId, title, dateStr] = match;
        const cleanTitle = title.trim();
        if (!cleanTitle || cleanTitle.length < 3) continue;
        
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

    console.log(`[sync-city-calendar] Found ${events.length} future events (parse_items_found=${events.length})`);

    if (events.length === 0 && html.length > 1000) {
      // Got content but parsed nothing — markup drift
      await updateSourceHealth(supabase, source.id, false, "parse_zero", `Fetched ${html.length} chars but parsed 0 events`);
    } else if (events.length > 0) {
      await updateSourceHealth(supabase, source.id, true);
    } else {
      await updateSourceHealth(supabase, source.id, false, "empty_content", `Only ${html.length} chars fetched`);
    }

    // Dedupe and insert events
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const dedupeKey = generateDedupeKey(event.title, event.date, event.url);
        
        const { data: existing } = await supabase
          .from("content_queue")
          .select("id")
          .eq("metadata->>dedupe_key", dedupeKey)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error: insertError } = await supabase
          .from("content_queue")
          .insert({
            source_id: source.id,
            title: event.title,
            content: event.description,
            original_url: event.url,
            category: "civic",
            status: "auto_published",
            safety_level: "safe",
            event_date: event.date,
            event_time: event.time,
            geo_tier: 1,
            geo_label: "Lake Geneva",
            decision_path: "city_calendar_auto_publish",
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
