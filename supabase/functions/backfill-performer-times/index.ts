import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract performer name from event title/content
function extractPerformer(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "Live Music: Artist Name" or "Live Music - Artist Name"
  const liveMusicMatch = text.match(/live\s+music[:\s-]+([^@\n\r]+?)(?:\s*[@\-–]|\s*$)/i);
  if (liveMusicMatch) {
    const performer = liveMusicMatch[1].trim();
    if (performer.length > 2 && performer.length < 80 && !performer.toLowerCase().includes('every')) {
      return performer;
    }
  }
  
  // Pattern: "featuring Artist Name" or "feat. Artist"
  const featMatch = text.match(/(?:featuring|feat\.?)\s+([^@\n\r,]+)/i);
  if (featMatch) {
    return featMatch[1].trim();
  }
  
  // Pattern: "with Artist Name" (at start or after venue)
  const withMatch = text.match(/\bwith\s+([A-Z][^@\n\r,]+?)(?:\s*[-–@]|\s*$)/i);
  if (withMatch) {
    const performer = withMatch[1].trim();
    if (performer.length > 2 && performer.length < 60) {
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

// Extract event time from content
function extractEventTime(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "2:00 PM to 5:00 PM" or "2pm - 5pm" or "2:00 PM – 5:00 PM"
  const timeRangeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (timeRangeMatch) {
    return `${timeRangeMatch[1].toUpperCase().replace(/\s/g, '')} - ${timeRangeMatch[2].toUpperCase().replace(/\s/g, '')}`;
  }
  
  // Pattern: single time like "starts at 7pm" or "@ 8:00 PM"
  const singleTimeMatch = text.match(/(?:starts?\s+(?:at\s+)?|@\s*)(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (singleTimeMatch) {
    return singleTimeMatch[1].toUpperCase().replace(/\s/g, '');
  }
  
  // Pattern: "5:30 pm - 8:30 pm" (lowercase)
  const lowercaseRange = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i);
  if (lowercaseRange) {
    return `${lowercaseRange[1].toUpperCase().replace(/\s/g, '')} - ${lowercaseRange[2].toUpperCase().replace(/\s/g, '')}`;
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
