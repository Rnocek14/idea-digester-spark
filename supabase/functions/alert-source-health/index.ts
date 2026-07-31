// Daily source-health digest. The silent failure mode this closes: a scraper that
// returns HTTP 200 with zero items still counts as a "successful" fetch, so a dead
// source can starve coverage for weeks with every dashboard light green. This sends
// the operator an email whenever any active source looks unhealthy.
//
// Two more silent failure modes closed after the site went visibly stale:
//   * sync-rss auto-disables a source (status='error') after 3 consecutive
//     failures — this digest previously only looked at status='active', so the
//     sources most likely to explain missing coverage were invisible to it.
//   * Every check here is per-source. If the whole pipeline stalls (crons dead,
//     everything stuck in pending), no single source looks unhealthy while the
//     public feed goes stale. The content-freshness check below watches the
//     output instead: newest ingested row and newest live (publicly visible)
//     story.
// The health snapshot is now also written to activity_log on every run — even
// when email isn't configured — so the run is never a silent no-op.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_RUN_WARN_THRESHOLD = 4;
const STALE_FETCH_HOURS = 48;
const MIN_HOURS_BETWEEN_ALERTS = 20;
// Freshness thresholds for the pipeline as a whole. Ingestion crons run every
// 10-30 minutes, so 12 quiet hours means the crons themselves are dead. The
// live-story threshold is tighter than the 2 days it took a human to notice:
// with a daily brief plus hourly news scraping, a site with nothing new for a
// full day is broken, not quiet.
const STALE_INGEST_HOURS = 12;
const STALE_LIVE_STORY_HOURS = 24;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Include auto-disabled (status='error') sources: those are the ones most
    // likely to explain missing coverage, and they used to vanish from this
    // digest the moment sync-rss disabled them.
    const { data: sources, error } = await supabase
      .from("sources")
      .select(
        "id, name, type, category, status, health_severity, consecutive_zero_runs, last_successful_fetch_at, last_nonzero_run_at, last_error_code, last_error_detail"
      )
      .in("status", ["active", "error"]);

    if (error) throw error;

    const now = Date.now();
    const staleCutoffMs = STALE_FETCH_HOURS * 60 * 60 * 1000;

    const unhealthy = (sources ?? []).filter((s) => {
      const autoDisabled = s.status === "error";
      const severityBad = ["warn", "warning", "critical"].includes(s.health_severity);
      const zeroRuns = (s.consecutive_zero_runs ?? 0) >= ZERO_RUN_WARN_THRESHOLD;
      const staleFetch =
        !s.last_successful_fetch_at ||
        now - new Date(s.last_successful_fetch_at).getTime() > staleCutoffMs;
      return autoDisabled || severityBad || zeroRuns || staleFetch;
    });

    // Pipeline-output freshness: newest ingested row (any status) and newest
    // live story (the same status/safety filters the public feed applies).
    const [{ data: newestIngested }, { data: newestLive }] = await Promise.all([
      supabase
        .from("content_queue")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("content_queue")
        .select("created_at")
        .in("status", ["published", "auto_published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const ingestAgeHours = hoursSince(newestIngested?.created_at);
    const liveAgeHours = hoursSince(newestLive?.created_at);
    const ingestStale = ingestAgeHours === null || ingestAgeHours > STALE_INGEST_HOURS;
    const liveStale = liveAgeHours === null || liveAgeHours > STALE_LIVE_STORY_HOURS;

    const needsAttention = unhealthy.length > 0 || ingestStale || liveStale;

    const snapshot = {
      sources_checked: sources?.length ?? 0,
      unhealthy: unhealthy.length,
      unhealthy_names: unhealthy.map((s) => s.name),
      auto_disabled: unhealthy.filter((s) => s.status === "error").map((s) => s.name),
      ingest_age_hours: ingestAgeHours === null ? null : Math.round(ingestAgeHours * 10) / 10,
      live_story_age_hours: liveAgeHours === null ? null : Math.round(liveAgeHours * 10) / 10,
      ingest_stale: ingestStale,
      live_story_stale: liveStale,
    };

    // Always record the snapshot — a health check that can't email must never
    // be indistinguishable from a health check that found nothing.
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "system",
      action: "source_health_check",
      message: needsAttention
        ? `Source health: ${unhealthy.length} unhealthy source(s)` +
          (ingestStale ? `; no ingest in ${snapshot.ingest_age_hours ?? "?"}h` : "") +
          (liveStale ? `; no live story in ${snapshot.live_story_age_hours ?? "?"}h` : "")
        : "Source health: all healthy",
      details: snapshot,
    });

    if (!needsAttention) {
      console.log("[alert-source-health] All sources healthy, content fresh");
      return jsonResponse({ success: true, ...snapshot });
    }

    const alertEmail = Deno.env.get("ALERT_EMAIL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!alertEmail || !resendApiKey) {
      console.warn(
        "[alert-source-health] Attention needed but ALERT_EMAIL / RESEND_API_KEY not set — snapshot logged to activity_log only. Set both in Supabase secrets to enable email alerts."
      );
      return jsonResponse({ success: true, skipped: "email_not_configured", ...snapshot });
    }

    // Don't send more than one digest per MIN_HOURS_BETWEEN_ALERTS (also dedupes
    // double-scheduled crons and manual invocations).
    const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_ALERTS * 60 * 60 * 1000).toISOString();
    const { count: recentAlerts } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "source_health_alert")
      .gte("created_at", cutoff);

    if ((recentAlerts ?? 0) > 0) {
      return jsonResponse({ success: true, skipped: "alert already sent recently", ...snapshot });
    }

    const freshnessRows = [
      ingestStale
        ? `<li><strong>Ingestion stale:</strong> newest content_queue row is ${
            snapshot.ingest_age_hours ?? "unknown"
          }h old (threshold ${STALE_INGEST_HOURS}h) — check cron jobs and ingestion functions.</li>`
        : "",
      liveStale
        ? `<li><strong>Public feed stale:</strong> newest live story is ${
            snapshot.live_story_age_hours ?? "unknown"
          }h old (threshold ${STALE_LIVE_STORY_HOURS}h) — check the publish gate / pending backlog.</li>`
        : "",
    ].join("");

    const rows = unhealthy
      .map((s) => {
        const lastOk = s.last_successful_fetch_at
          ? new Date(s.last_successful_fetch_at).toLocaleString("en-US", { timeZone: "America/Chicago" })
          : "never";
        const lastItems = s.last_nonzero_run_at
          ? new Date(s.last_nonzero_run_at).toLocaleString("en-US", { timeZone: "America/Chicago" })
          : "never";
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.status === "error" ? "auto-disabled" : s.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.health_severity}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.consecutive_zero_runs}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${lastOk}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${lastItems}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.last_error_code ?? ""}</td>
        </tr>`;
      })
      .join("");

    const sourceTable = unhealthy.length
      ? `<table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tr style="text-align:left;background:#f7f7f7;">
            <th style="padding:6px 10px;">Source</th>
            <th style="padding:6px 10px;">Status</th>
            <th style="padding:6px 10px;">Severity</th>
            <th style="padding:6px 10px;">Zero runs</th>
            <th style="padding:6px 10px;">Last OK fetch</th>
            <th style="padding:6px 10px;">Last items</th>
            <th style="padding:6px 10px;">Error</th>
          </tr>
          ${rows}
        </table>`
      : "";

    const subjectParts = [
      unhealthy.length ? `${unhealthy.length} source${unhealthy.length === 1 ? "" : "s"}` : "",
      ingestStale ? "ingest stale" : "",
      liveStale ? "feed stale" : "",
    ].filter(Boolean);

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;">
        <h2 style="margin:16px 0 4px;">⚠️ Pipeline health needs attention</h2>
        <p style="color:#555;margin:0 0 16px;">Sources that are erroring, auto-disabled, returning zero items repeatedly, or haven't fetched successfully in ${STALE_FETCH_HOURS}h — plus overall content freshness.</p>
        ${freshnessRows ? `<ul style="color:#b00;margin:0 0 16px;">${freshnessRows}</ul>` : ""}
        ${sourceTable}
        <p style="color:#888;font-size:12px;margin-top:16px;">Lake Geneva Brief · Source Health digest · review at /dashboard/source-health</p>
      </div>`;

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: "Lake Geneva Brief Alerts <newsletter@citybrief.info>",
      to: alertEmail,
      subject: `⚠️ Pipeline health: ${subjectParts.join(", ")} need attention`,
      html,
    });

    if (sendError) throw new Error(`Resend error: ${sendError.message}`);

    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "system",
      action: "source_health_alert",
      message: `Source health digest sent: ${unhealthy.length} unhealthy sources` +
        (ingestStale || liveStale ? " + stale content warning" : ""),
      details: snapshot,
    });

    console.log(`[alert-source-health] Digest sent for ${unhealthy.length} sources (ingestStale=${ingestStale}, liveStale=${liveStale})`);
    return jsonResponse({ success: true, emailed: true, ...snapshot });
  } catch (error) {
    console.error("[alert-source-health] Error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
