import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  dtstart?: string;
  dtend?: string;
  location?: string;
  imageUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🏛️ Starting Geneva Lake West Chamber Events sync (iCal)...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use the MEC iCal feed endpoint (not blocked like RSS)
    const feedUrl = "https://genevalakewest.com/?mec-ical-feed=1";
    
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/calendar, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const icalText = await response.text();
    console.log(`📥 Fetched iCal feed (${icalText.length} bytes)`);

    // Parse iCal events
    const events = parseICalEvents(icalText);
    console.log(`📋 Parsed ${events.length} events from iCal feed`);

    let inserted = 0;
    let skipped = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const event of events) {
      // Extract event date from DTSTART
      let eventDate: string | null = null;
      let eventTime: string | null = null;
      
      if (event.dtstart) {
        const parsed = parseICalDateTime(event.dtstart);
        if (parsed) {
          eventDate = parsed.date;
          eventTime = parsed.time;
        }
      }

      // Skip past events
      if (eventDate && eventDate < today) {
        console.log(`⏭️ Skipping past event: "${event.summary}" (${eventDate})`);
        skipped++;
        continue;
      }

      // Check for existing entry by URL or title
      const { data: existing } = await supabase
        .from("content_queue")
        .select("id")
        .or(`original_url.eq.${event.url || ''},title.eq.${event.summary}`)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Skipping duplicate: "${event.summary}"`);
        skipped++;
        continue;
      }

      // Clean description
      let summary = event.description || '';
      summary = summary.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (summary.length > 300) {
        summary = summary.substring(0, 297) + '...';
      }

      // Build content
      const content = `Geneva Lake West Chamber Event: ${event.summary}${eventDate ? ` on ${eventDate}` : ''}${eventTime ? ` at ${eventTime}` : ''}. ${summary}`;

      // Insert new event
      const { error: insertError } = await supabase
        .from("content_queue")
        .insert({
          title: decodeHtmlEntities(event.summary),
          content,
          summary: summary || `Geneva Lake West Chamber event: ${event.summary}`,
          original_url: event.url,
          image_url: event.imageUrl,
          category: "events",
          status: "auto_published",
          safety_level: "safe",
          geo_tier: 1,
          geo_label: "Geneva Lake West",
          event_date: eventDate,
          event_time: eventTime,
          source_id: await getSourceId(supabase),
          metadata: {
            ical_uid: event.uid,
            synced_at: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error(`❌ Failed to insert "${event.summary}":`, insertError.message);
      } else {
        console.log(`✅ Inserted: "${event.summary}" (${eventDate || 'no date'})`);
        inserted++;
      }
    }

    // Update source last_fetched_at
    const sourceId = await getSourceId(supabase);
    if (sourceId) {
      await supabase
        .from("sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", sourceId);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Geneva Lake West Chamber sync complete: ${inserted} inserted, ${skipped} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        eventsFound: events.length,
        inserted,
        skipped,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Geneva Lake West Chamber sync failed:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseICalEvents(icalText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  
  // Split by VEVENT blocks
  const eventBlocks = icalText.split('BEGIN:VEVENT');
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    
    const event: ICalEvent = {
      uid: extractICalProperty(block, 'UID') || `event-${i}`,
      summary: extractICalProperty(block, 'SUMMARY') || '',
      description: extractICalProperty(block, 'DESCRIPTION'),
      url: extractICalProperty(block, 'URL'),
      dtstart: extractICalProperty(block, 'DTSTART') || extractICalPropertyWithParams(block, 'DTSTART'),
      dtend: extractICalProperty(block, 'DTEND') || extractICalPropertyWithParams(block, 'DTEND'),
      location: extractICalProperty(block, 'LOCATION'),
      imageUrl: extractAttachment(block),
    };
    
    if (event.summary) {
      events.push(event);
    }
  }
  
  return events;
}

function extractICalProperty(block: string, property: string): string | undefined {
  // Match property:value format
  const regex = new RegExp(`^${property}:(.*)$`, 'mi');
  const match = block.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractICalPropertyWithParams(block: string, property: string): string | undefined {
  // Match property;params:value format (e.g., DTSTART;TZID=America/Chicago:20251218T173000)
  const regex = new RegExp(`^${property}[^:]*:(.*)$`, 'mi');
  const match = block.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractAttachment(block: string): string | undefined {
  // Look for ATTACH;FMTTYPE=image/...:url
  const regex = /ATTACH;FMTTYPE=image\/[^:]+:(.*)$/mi;
  const match = block.match(regex);
  return match ? match[1].trim() : undefined;
}

function parseICalDateTime(dtstring: string): { date: string; time: string | null } | null {
  // Format: 20251218T173000 or 20251218
  const match = dtstring.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  
  const [, year, month, day, hour, minute] = match;
  const date = `${year}-${month}-${day}`;
  
  let time: string | null = null;
  if (hour && minute) {
    const h = parseInt(hour);
    const m = minute;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    time = `${hour12}:${m} ${period}`;
  }
  
  return { date, time };
}

async function getSourceId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("id")
    .eq("name", "Geneva Lake West Chamber Events")
    .maybeSingle();
  return data?.id || null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&hellip;/g, '...');
}
