import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract performer name from event title/content
// Stop-phrases that indicate garbage performer extraction
const PERFORMER_STOP_PHRASES = [
  'then from', 'your kids', 'click here', 'http', 'register',
  'discounts and', 'planned tributes', 'syrup for', 'businesses the',
  'bringing the laughs', 'every friday', 'every saturday', 'every week',
  'sign up', 'learn more', 'tickets available', 'buy tickets'
];

function isValidPerformer(performer: string): boolean {
  if (!performer || performer.length < 3 || performer.length > 50) return false;
  const lower = performer.toLowerCase();
  if (PERFORMER_STOP_PHRASES.some(p => lower.includes(p))) return false;
  // Reject if contains multiple sentences (period followed by space and capital)
  if (/\.\s+[A-Z]/.test(performer)) return false;
  // Reject if mostly lowercase sentence-like text
  const words = performer.split(/\s+/);
  if (words.length > 6) return false;
  return true;
}

function extractPerformer(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "Live Music: Artist Name" or "Live Music - Artist Name"
  const liveMusicMatch = text.match(/live\s+music[:\s-]+([^@\n\r]+?)(?:\s*[@\-–]|\s*$)/i);
  if (liveMusicMatch) {
    const performer = liveMusicMatch[1].trim();
    if (isValidPerformer(performer)) {
      return performer;
    }
  }
  
  // Pattern: "featuring Artist Name" or "feat. Artist"
  const featMatch = text.match(/(?:featuring|feat\.?)\s+([^@\n\r,]+)/i);
  if (featMatch) {
    const performer = featMatch[1].trim();
    if (isValidPerformer(performer)) return performer;
  }
  
  // Pattern: "with Artist Name" (at start or after venue)
  const withMatch = text.match(/\bwith\s+([A-Z][^@\n\r,]+?)(?:\s*[-–@]|\s*$)/i);
  if (withMatch) {
    const performer = withMatch[1].trim();
    if (isValidPerformer(performer)) {
      return performer;
    }
  }
  
  // Pattern: Title is just the artist name
  const words = title.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 5) {
    const allCapitalized = words.every(w => /^[A-Z]/.test(w) || /^(the|and|of|&)$/i.test(w));
    const looksLikeName = allCapitalized && !title.toLowerCase().includes('live music') && 
                          !title.toLowerCase().includes('event') && !title.toLowerCase().includes('special');
    if (looksLikeName) {
      return title.trim();
    }
  }
  
  return null;
}

// Extract event time from content - enhanced patterns
function extractEventTime(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "2:00 PM to 5:00 PM" or "2pm - 5pm" or "2:00 PM – 5:00 PM"
  const timeRangeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (timeRangeMatch) {
    return `${timeRangeMatch[1].toUpperCase().replace(/\s/g, '')} - ${timeRangeMatch[2].toUpperCase().replace(/\s/g, '')}`;
  }
  
  // Pattern: "5:30 pm - 8:30 pm" (lowercase)
  const lowercaseRange = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i);
  if (lowercaseRange) {
    return `${lowercaseRange[1].toUpperCase().replace(/\s/g, '')} - ${lowercaseRange[2].toUpperCase().replace(/\s/g, '')}`;
  }
  
  // Pattern: single time like "starts at 7pm" or "@ 8:00 PM" or "beginning at 6:30"
  const singleTimeMatch = text.match(/(?:starts?\s+(?:at\s+)?|begins?\s+(?:at\s+)?|beginning\s+(?:at\s+)?|@\s*)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (singleTimeMatch) {
    let time = singleTimeMatch[1].trim();
    if (!/am|pm/i.test(time)) {
      const hour = parseInt(time.split(':')[0]);
      if (hour >= 1 && hour <= 11) {
        time += hour >= 5 ? 'PM' : (hour <= 6 ? 'PM' : 'AM');
      }
    }
    return time.toUpperCase().replace(/\s/g, '');
  }
  
  // Pattern: "at noon" or "at midnight"
  if (/\bat\s+noon\b/i.test(text)) return "12:00PM";
  if (/\bat\s+midnight\b/i.test(text)) return "12:00AM";
  
  // Pattern: standalone "7pm" or "8:00 PM" in title
  const titleTimeMatch = title.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (titleTimeMatch) {
    return titleTimeMatch[1].toUpperCase().replace(/\s/g, '');
  }
  
  // Pattern: 24-hour format like "19:00" or "20:30"
  const time24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time24Match) {
    let hours = parseInt(time24Match[1]);
    const minutes = time24Match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes}${period}`;
  }
  
  // Pattern: "doors at 7" or "show at 8" (context implies PM)
  const doorsMatch = text.match(/(?:doors|show|showtime|music)\s+(?:at\s+)?(\d{1,2})(?:\s|,|$)/i);
  if (doorsMatch) {
    const hour = parseInt(doorsMatch[1]);
    if (hour >= 1 && hour <= 11) {
      return `${hour}:00PM`;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get events with nightlife vertical that don't have performer or event_time set
    const { data: events, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, performer, event_time, metadata, original_url")
      .eq("category", "events")
      .or("performer.is.null,event_time.is.null")
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${events?.length || 0} events to process`);

    let updated = 0;
    let skipped = 0;

    for (const event of events || []) {
      // Check if this is a nightlife event
      const isNightlife = event.metadata?.verticals?.includes('nightlife') || 
                          event.metadata?.default_nightlife === true;
      
      if (!isNightlife) {
        skipped++;
        continue;
      }

      const performer = event.performer || extractPerformer(event.title, event.content);
      const eventTime = event.event_time || extractEventTime(event.title, event.content);

      // Only update if we found something new
      if ((performer && !event.performer) || (eventTime && !event.event_time)) {
        const updates: Record<string, string | null> = {};
        if (performer && !event.performer) updates.performer = performer;
        if (eventTime && !event.event_time) updates.event_time = eventTime;

        const { error: updateError } = await supabase
          .from("content_queue")
          .update(updates)
          .eq("id", event.id);

        if (updateError) {
          console.error(`Error updating event ${event.id}:`, updateError);
        } else {
          console.log(`✅ Updated "${event.title.substring(0, 40)}..." - performer: ${performer}, time: ${eventTime}`);
          updated++;
        }
      } else {
        skipped++;
      }
    }

    console.log(`Backfill complete: ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: events?.length || 0,
        updated,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
