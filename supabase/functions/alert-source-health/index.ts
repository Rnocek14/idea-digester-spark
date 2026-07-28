// Daily source-health digest. The silent failure mode this closes: a scraper that
// returns HTTP 200 with zero items still counts as a "successful" fetch, so a dead
// source can starve coverage for weeks with every dashboard light green. This sends
// the operator an email whenever any active source looks unhealthy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_RUN_WARN_THRESHOLD = 4;
const STALE_FETCH_HOURS = 48;
const MIN_HOURS_BETWEEN_ALERTS = 20;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const alertEmail = Deno.env.get("ALERT_EMAIL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!alertEmail || !resendApiKey) {
      console.log("[alert-source-health] ALERT_EMAIL or RESEND_API_KEY not set — skipping (set ALERT_EMAIL in Supabase secrets to enable alerts)");
      return jsonResponse({ success: true, skipped: "ALERT_EMAIL or RESEND_API_KEY not configured" });
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
      return jsonResponse({ success: true, skipped: "alert already sent recently" });
    }

    const { data: sources, error } = await supabase
      .from("sources")
      .select(
        "id, name, type, category, health_severity, consecutive_zero_runs, last_successful_fetch_at, last_nonzero_run_at, last_error_code, last_error_detail"
      )
      .eq("status", "active");

    if (error) throw error;

    const now = Date.now();
    const staleCutoffMs = STALE_FETCH_HOURS * 60 * 60 * 1000;

    const unhealthy = (sources ?? []).filter((s) => {
      const severityBad = ["warn", "warning", "critical"].includes(s.health_severity);
      const zeroRuns = (s.consecutive_zero_runs ?? 0) >= ZERO_RUN_WARN_THRESHOLD;
      const staleFetch =
        !s.last_successful_fetch_at ||
        now - new Date(s.last_successful_fetch_at).getTime() > staleCutoffMs;
      return severityBad || zeroRuns || staleFetch;
    });

    if (unhealthy.length === 0) {
      console.log("[alert-source-health] All active sources healthy");
      return jsonResponse({ success: true, unhealthy: 0 });
    }

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
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.health_severity}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${s.consecutive_zero_runs}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${lastOk}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${lastItems}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.last_error_code ?? ""}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;">
        <h2 style="margin:16px 0 4px;">⚠️ ${unhealthy.length} source${unhealthy.length === 1 ? "" : "s"} need attention</h2>
        <p style="color:#555;margin:0 0 16px;">Active sources that are erroring, returning zero items repeatedly, or haven't fetched successfully in ${STALE_FETCH_HOURS}h.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tr style="text-align:left;background:#f7f7f7;">
            <th style="padding:6px 10px;">Source</th>
            <th style="padding:6px 10px;">Severity</th>
            <th style="padding:6px 10px;">Zero runs</th>
            <th style="padding:6px 10px;">Last OK fetch</th>
            <th style="padding:6px 10px;">Last items</th>
            <th style="padding:6px 10px;">Error</th>
          </tr>
          ${rows}
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px;">Lake Geneva Brief · Source Health digest · review at /dashboard/source-health</p>
      </div>`;

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: "Lake Geneva Brief Alerts <newsletter@citybrief.info>",
      to: alertEmail,
      subject: `⚠️ Source health: ${unhealthy.length} source${unhealthy.length === 1 ? "" : "s"} need attention`,
      html,
    });

    if (sendError) throw new Error(`Resend error: ${sendError.message}`);

    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "system",
      action: "source_health_alert",
      message: `Source health digest sent: ${unhealthy.length} unhealthy sources`,
      details: { unhealthy: unhealthy.map((s) => s.name) },
    });

    console.log(`[alert-source-health] Digest sent for ${unhealthy.length} sources`);
    return jsonResponse({ success: true, unhealthy: unhealthy.length });
  } catch (error) {
    console.error("[alert-source-health] Error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
