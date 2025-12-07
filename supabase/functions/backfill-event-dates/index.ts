import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get the next occurrence of a specific day of week (0=Sunday, 6=Saturday)
function getNextDayOfWeek(dayOfWeek: number): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntil);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

// Parse event date from title/content patterns
function parseEventDate(title: string, content?: string): Date | null {
  const text = `${title} ${content || ''}`.toLowerCase();
  
  const dayPatterns: { pattern: RegExp; day: number }[] = [
    { pattern: /\b(every\s+)?sunday/i, day: 0 },
    { pattern: /\b(every\s+)?monday/i, day: 1 },
    { pattern: /\b(every\s+)?tuesday/i, day: 2 },
    { pattern: /\b(every\s+)?wednesday/i, day: 3 },
    { pattern: /\b(every\s+)?thursday/i, day: 4 },
    { pattern: /\b(every\s+)?friday/i, day: 5 },
    { pattern: /\b(every\s+)?saturday/i, day: 6 },
  ];
  
  for (const { pattern, day } of dayPatterns) {
    if (pattern.test(text)) {
      return getNextDayOfWeek(day);
    }
  }
  
  // Check for specific date patterns
  const specificDateMatch = text.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (specificDateMatch) {
    const parsed = new Date(`${specificDateMatch[1]} ${specificDateMatch[2]}, ${specificDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDateMatch) {
    const parsed = new Date(`${slashDateMatch[1]}/${slashDateMatch[2]}/${slashDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
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

    // Get nightlife events without event_date
    const { data: events, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, metadata")
      .eq("category", "events")
      .is("event_date", null)
      .contains("metadata", { verticals: ["nightlife"] })
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${events?.length || 0} nightlife events without event_date`);

    let updated = 0;
    let skipped = 0;

    for (const event of events || []) {
      const parsedDate = parseEventDate(event.title, event.content);
      
      if (parsedDate) {
        const eventDateStr = parsedDate.toISOString().split('T')[0];
        
        const { error: updateError } = await supabase
          .from("content_queue")
          .update({ 
            event_date: eventDateStr,
            metadata: {
              ...event.metadata,
              event_date: eventDateStr
            }
          })
          .eq("id", event.id);

        if (updateError) {
          console.error(`Failed to update ${event.id}:`, updateError);
        } else {
          console.log(`✅ Updated "${event.title.substring(0, 40)}..." → ${eventDateStr}`);
          updated++;
        }
      } else {
        console.log(`⏭️ No date pattern found: "${event.title.substring(0, 40)}..."`);
        skipped++;
      }
    }

    const result = {
      success: true,
      processed: events?.length || 0,
      updated,
      skipped
    };

    console.log("Backfill result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
