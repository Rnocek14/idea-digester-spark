import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known recurring venue patterns with their days
const KNOWN_RECURRING_PATTERNS: { pattern: RegExp; days: string[] }[] = [
  // Specific venue recurring events
  { pattern: /topsy\s*turvy/i, days: ['sunday'] },
  { pattern: /lookout\s*bar/i, days: ['saturday'] },
  { pattern: /music\s*monday/i, days: ['monday'] },
  { pattern: /geneva\s*tap\s*house/i, days: ['thursday'] },
  { pattern: /pier\s*290.*live/i, days: ['friday', 'saturday'] },
  { pattern: /karaoke.*cat|cat.*karaoke/i, days: ['wednesday', 'friday', 'saturday'] },
  
  // Common recurring event patterns
  { pattern: /trivia\s*(tuesday|tuesdays)/i, days: ['tuesday'] },
  { pattern: /taco\s*tuesday/i, days: ['tuesday'] },
  { pattern: /wine\s*(wednesday|wednesdays)/i, days: ['wednesday'] },
  { pattern: /wing\s*(wednesday|wednesdays)/i, days: ['wednesday'] },
  { pattern: /thirsty\s*thursday/i, days: ['thursday'] },
  { pattern: /throwback\s*thursday/i, days: ['thursday'] },
  { pattern: /fish\s*fry\s*friday/i, days: ['friday'] },
  { pattern: /friday\s*fish\s*fry/i, days: ['friday'] },
  { pattern: /happy\s*hour/i, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
  { pattern: /sunday\s*brunch/i, days: ['sunday'] },
  { pattern: /saturday\s*night\s*live/i, days: ['saturday'] },
  { pattern: /open\s*mic\s*(night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, days: [] }, // Will extract day from match
  
  // Day-specific patterns in title
  { pattern: /\bmonday\s+(nights?|music|jam|live)/i, days: ['monday'] },
  { pattern: /\btuesday\s+(nights?|music|jam|live|trivia)/i, days: ['tuesday'] },
  { pattern: /\bwednesday\s+(nights?|music|jam|live|karaoke)/i, days: ['wednesday'] },
  { pattern: /\bthursday\s+(nights?|music|jam|live|throwdown)/i, days: ['thursday'] },
  { pattern: /\bfriday\s+(nights?|music|jam|live)/i, days: ['friday'] },
  { pattern: /\bsaturday\s+(nights?|music|jam|live)/i, days: ['saturday'] },
  { pattern: /\bsunday\s+(nights?|music|jam|live|funday)/i, days: ['sunday'] },
];

// Extract recurring days of week from title/content
function extractRecurringDays(title: string, content?: string): string[] | null {
  const text = `${title} ${content || ''}`.toLowerCase();
  const foundDays: string[] = [];
  
  // Check known recurring patterns first
  for (const { pattern, days } of KNOWN_RECURRING_PATTERNS) {
    if (pattern.test(title)) {
      foundDays.push(...days);
    }
  }
  
  // If found via known patterns, return early
  if (foundDays.length > 0) {
    return [...new Set(foundDays)];
  }
  
  // Check for generic recurring indicators
  const isRecurring = text.includes('every ') || 
                      text.includes('weekly ') || 
                      text.includes('daily ') ||
                      text.includes('recurring');
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (const day of dayNames) {
    const patterns = [
      new RegExp(`every\\s+${day}`, 'i'),
      new RegExp(`${day}s\\b`, 'i'),
      new RegExp(`${day}\\s+night`, 'i'),
      new RegExp(`${day}\\s+live`, 'i'),
      new RegExp(`live\\s+music\\s+${day}`, 'i'),
    ];
    
    if (isRecurring && text.includes(day)) {
      foundDays.push(day);
    } else {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          foundDays.push(day);
          break;
        }
      }
    }
  }
  
  // Handle special cases
  if (text.includes('daily ') || text.includes('every day')) {
    return dayNames;
  }
  
  if (text.includes('weekend') && foundDays.length === 0) {
    return ['friday', 'saturday', 'sunday'];
  }
  
  if ((text.includes('weeknight') || text.includes('weekday')) && foundDays.length === 0) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }
  
  return foundDays.length > 0 ? [...new Set(foundDays)] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { limit = 100, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[backfill-recurring-days] Starting backfill, limit=${limit}, dry_run=${dry_run}`);

    // Fetch nightlife events without recurring_days
    const { data: events, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, metadata")
      .eq("category", "events")
      .contains("metadata", { verticals: ["nightlife"] })
      .is("event_date", null) // Only recurring events (no specific date)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    console.log(`[backfill-recurring-days] Found ${events?.length || 0} nightlife events to process`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const event of events || []) {
      results.processed++;
      
      // Skip if already has recurring_days
      if (event.metadata?.recurring_days && Array.isArray(event.metadata.recurring_days)) {
        console.log(`[backfill-recurring-days] Skipping "${event.title.substring(0, 40)}..." - already has recurring_days`);
        results.skipped++;
        continue;
      }

      const recurringDays = extractRecurringDays(event.title, event.content);
      
      if (recurringDays && recurringDays.length > 0) {
        console.log(`[backfill-recurring-days] "${event.title.substring(0, 40)}..." → [${recurringDays.join(', ')}]`);
        
        if (!dry_run) {
          const updatedMetadata = {
            ...(event.metadata || {}),
            recurring_days: recurringDays,
          };

          const { error: updateError } = await supabase
            .from("content_queue")
            .update({ metadata: updatedMetadata })
            .eq("id", event.id);

          if (updateError) {
            console.error(`[backfill-recurring-days] Update error for ${event.id}: ${updateError.message}`);
            results.errors.push(`${event.id}: ${updateError.message}`);
          } else {
            results.updated++;
          }
        } else {
          results.updated++; // Count as would-be-updated in dry run
        }
      } else {
        console.log(`[backfill-recurring-days] "${event.title.substring(0, 40)}..." → no days detected`);
        results.skipped++;
      }
    }

    console.log(`[backfill-recurring-days] Complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`);

    // Log activity
    if (!dry_run && results.updated > 0) {
      await supabase.from("activity_log").insert({
        entity_type: "content",
        action: "backfill_recurring_days",
        actor_type: "system",
        message: `Backfilled recurring_days for ${results.updated} nightlife events`,
        details: results,
      });
    }

    return new Response(JSON.stringify({ success: true, ...results, dry_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[backfill-recurring-days] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
