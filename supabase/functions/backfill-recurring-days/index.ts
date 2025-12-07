import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract recurring days of week from title/content (e.g., "Every Friday" → ["friday"])
function extractRecurringDays(title: string, content?: string): string[] | null {
  const text = `${title} ${content || ''}`.toLowerCase();
  
  const isRecurring = text.includes('every ') || 
                      text.includes('weekly ') || 
                      text.includes('daily ') ||
                      text.includes('recurring');
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const foundDays: string[] = [];
  
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
