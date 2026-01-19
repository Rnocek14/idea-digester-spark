import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    console.log(`[auto-expire-content] Running expiry check for date: ${todayStr}`);

    // 1. Expire content where event_date has passed
    const { data: expiredByEventDate, error: eventDateError } = await supabase
      .from("content_queue")
      .update({
        status: "expired",
        updated_at: now.toISOString(),
      })
      .in("status", ["pending", "approved", "auto_published", "published"])
      .lt("event_date", todayStr)
      .not("event_date", "is", null)
      .select("id, title, event_date");

    if (eventDateError) {
      console.error("[auto-expire-content] Error expiring by event_date:", eventDateError);
    } else {
      console.log(`[auto-expire-content] Expired ${expiredByEventDate?.length || 0} items by event_date`);
      expiredByEventDate?.forEach((item) => {
        console.log(`  - "${item.title}" (event_date: ${item.event_date})`);
      });
    }

    // 2. Expire stale holiday content after the season (Dec 26 - Jan 15)
    const isPostHolidaySeason = 
      (now.getMonth() === 0 && now.getDate() <= 15) || // Jan 1-15
      (now.getMonth() === 11 && now.getDate() >= 26);   // Dec 26-31

    let expiredHolidayCount = 0;
    if (isPostHolidaySeason) {
      const holidayPatterns = [
        "%santa%",
        "%christmas%",
        "%holiday parade%",
        "%ugly sweater%",
        "%christmas tree lighting%",
        "%holiday lights%",
      ];

      for (const pattern of holidayPatterns) {
        const { data: expiredHoliday, error: holidayError } = await supabase
          .from("content_queue")
          .update({
            status: "expired",
            updated_at: now.toISOString(),
          })
          .in("status", ["pending", "approved", "auto_published", "published"])
          .ilike("title", pattern)
          .select("id, title");

        if (holidayError) {
          console.error(`[auto-expire-content] Error expiring holiday content (${pattern}):`, holidayError);
        } else if (expiredHoliday && expiredHoliday.length > 0) {
          expiredHolidayCount += expiredHoliday.length;
          expiredHoliday.forEach((item) => {
            console.log(`  - Holiday expired: "${item.title}"`);
          });
        }
      }
      console.log(`[auto-expire-content] Expired ${expiredHolidayCount} holiday items`);
    }

    // 3. Expire Tier-0 pending from regional sources after 72 hours
    // This keeps the queue clean without human review time
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: expiredTier0, error: tier0Error } = await supabase
      .from("content_queue")
      .update({
        status: "expired",
        updated_at: now.toISOString(),
      })
      .eq("status", "pending")
      .eq("geo_tier", 0)
      .lt("created_at", threeDaysAgo.toISOString())
      .select("id, title, source_id, created_at");

    if (tier0Error) {
      console.error("[auto-expire-content] Error expiring Tier-0 pending:", tier0Error);
    } else {
      console.log(`[auto-expire-content] Expired ${expiredTier0?.length || 0} Tier-0 pending items (>72 hours old)`);
      expiredTier0?.slice(0, 5).forEach((item) => {
        console.log(`  - Tier-0 expired: "${item.title?.substring(0, 50)}..."`);
      });
    }

    // 4. Expire very old pending content (> 30 days old with no event_date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: expiredStale, error: staleError } = await supabase
      .from("content_queue")
      .update({
        status: "expired",
        updated_at: now.toISOString(),
      })
      .eq("status", "pending")
      .is("event_date", null)
      .gt("geo_tier", 0) // Only expire non-Tier-0 (Tier-0 handled above with 72h rule)
      .lt("created_at", thirtyDaysAgo.toISOString())
      .select("id, title, created_at");

    if (staleError) {
      console.error("[auto-expire-content] Error expiring stale pending:", staleError);
    } else {
      console.log(`[auto-expire-content] Expired ${expiredStale?.length || 0} stale pending items (>30 days old)`);
    }

    const totalExpired = 
      (expiredByEventDate?.length || 0) + 
      expiredHolidayCount + 
      (expiredTier0?.length || 0) +
      (expiredStale?.length || 0);

    // Log activity
    if (totalExpired > 0) {
      await supabase.from("activity_log").insert({
        actor_type: "system",
        entity_type: "content",
        action: "auto_expire",
        message: `Auto-expired ${totalExpired} content items`,
        details: {
          expired_by_event_date: expiredByEventDate?.length || 0,
          expired_holiday: expiredHolidayCount,
          expired_tier0_pending: expiredTier0?.length || 0,
          expired_stale: expiredStale?.length || 0,
          run_date: todayStr,
        },
      });
    }

    const summary = {
      success: true,
      total_expired: totalExpired,
      by_event_date: expiredByEventDate?.length || 0,
      by_holiday: expiredHolidayCount,
      by_tier0_pending: expiredTier0?.length || 0,
      by_stale: expiredStale?.length || 0,
      run_date: todayStr,
    };

    console.log("[auto-expire-content] Complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[auto-expire-content] Fatal error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
