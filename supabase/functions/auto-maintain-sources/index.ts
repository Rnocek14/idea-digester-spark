// Self-healing source maintenance — zero-touch by design (one operator, many
// cities). Runs daily on cron and performs only safe, idempotent cleanup that
// previously required a human clicking buttons in the dashboard:
//
//   1. Auto-retire active sources that have been dead for 30+ days
//      (100+ consecutive zero-item runs and no items in a month).
//   2. Auto-deactivate sources stuck in status='error' for 14+ days.
//   3. Expire stale 'ready' newsletters older than 7 days.
//
// Deliberately has NO arbitrary action switch (unlike cleanup-system) so it is
// safe to expose to cron without auth. Rate-limited to one effective run per
// 20h via activity_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEAD_ZERO_RUNS = 100;
const DEAD_SILENT_DAYS = 30;
const ERROR_STUCK_DAYS = 14;
const NEWSLETTER_STALE_DAYS = 7;

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
    const results: Record<string, unknown> = {};

    // Rate limit: one effective run per 20h (also dedupes double-scheduled crons).
    const runCutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
    const { count: recentRuns } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "auto_maintain_sources")
      .gte("created_at", runCutoff);
    if ((recentRuns ?? 0) > 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: "already ran recently" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Auto-retire long-dead active sources.
    const silentCutoff = new Date(now.getTime() - DEAD_SILENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: deadCandidates } = await supabase
      .from("sources")
      .select("id, name, consecutive_zero_runs, last_nonzero_run_at, metadata")
      .eq("status", "active")
      .gte("consecutive_zero_runs", DEAD_ZERO_RUNS);

    const dead = (deadCandidates ?? []).filter(
      (s) => !s.last_nonzero_run_at || s.last_nonzero_run_at < silentCutoff
    );
    for (const s of dead) {
      await supabase
        .from("sources")
        .update({
          status: "inactive",
          metadata: {
            ...(s.metadata ?? {}),
            retired: true,
            retired_reason: `auto: ${s.consecutive_zero_runs} consecutive zero-item runs, no items in ${DEAD_SILENT_DAYS}+ days`,
            retired_at: now.toISOString(),
          },
        })
        .eq("id", s.id);
    }
    results.auto_retired = dead.map((s) => s.name);

    // 2) Auto-deactivate sources stuck in error status.
    const errorCutoff = new Date(now.getTime() - ERROR_STUCK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: stuckErrors } = await supabase
      .from("sources")
      .select("id, name, metadata")
      .eq("status", "error")
      .lt("updated_at", errorCutoff);
    for (const s of stuckErrors ?? []) {
      await supabase
        .from("sources")
        .update({
          status: "inactive",
          metadata: {
            ...(s.metadata ?? {}),
            retired: true,
            retired_reason: `auto: stuck in error status for ${ERROR_STUCK_DAYS}+ days`,
            retired_at: now.toISOString(),
          },
        })
        .eq("id", s.id);
    }
    results.error_deactivated = (stuckErrors ?? []).map((s) => s.name);

    // 3) Expire stale ready newsletters.
    const nlCutoff = new Date(now.getTime() - NEWSLETTER_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await supabase
      .from("newsletters")
      .update({ status: "expired" })
      .eq("status", "ready")
      .lt("created_at", nlCutoff)
      .select("id");
    results.expired_newsletters = expired?.length ?? 0;

    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "system",
      action: "auto_maintain_sources",
      message: `Auto-maintenance: retired ${dead.length}, deactivated ${stuckErrors?.length ?? 0} errored, expired ${expired?.length ?? 0} newsletters`,
      details: results,
    });

    console.log("[auto-maintain-sources] Completed:", results);
    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[auto-maintain-sources] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
