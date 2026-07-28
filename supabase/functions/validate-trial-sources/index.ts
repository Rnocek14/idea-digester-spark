// validate-trial-sources: the accuracy loop for discovered sources.
//
// Discovery output is never trusted. Every source enters as status='trial' and
// this daily cron fetches it and grades the result. Only repeated observed
// success promotes a source; repeated failure demotes it. No human involved.
//
//   trial --2 successful runs (HTTP 200, >=1 real item)--> active (default city)
//                                                          ready  (city not live yet)
//   trial --5 consecutive failures--------------------> inactive (auto-retired)
//
// Only rss/api types are auto-validated. 'scrape' types need per-site
// adaptation and stay 'candidate' until wired deliberately (C-tier sources are
// excluded from the city template per docs/automation-architecture.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMOTE_AFTER_SUCCESSES = 2;
const DEMOTE_AFTER_FAILURES = 5;
const MAX_PER_RUN = 50;
const FETCH_TIMEOUT_MS = 10000;

function countFeedItems(text: string): number {
  return (text.match(/<item[\s>]/gi) || []).length + (text.match(/<entry[\s>]/gi) || []).length;
}

function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 2000).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: trials, error } = await supabase
      .from("sources")
      .select("id, name, url, type, city_id, metadata")
      .eq("status", "trial")
      .in("type", ["rss", "api"])
      .limit(MAX_PER_RUN);
    if (error) throw error;

    const results = { checked: 0, promoted: 0, demoted: 0, pending: 0 };
    const detail: Array<Record<string, unknown>> = [];

    for (const src of trials ?? []) {
      results.checked++;
      const trial = (src.metadata?.trial as { successes?: number; failures?: number }) ?? {};
      let successes = trial.successes ?? 0;
      let failures = trial.failures ?? 0;

      let ok = false;
      let items = 0;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(src.url, {
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/rss+xml,application/xml,text/xml,*/*",
          },
        });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          items = countFeedItems(text);
          ok = looksLikeFeed(text) && items >= 1;
        }
      } catch (_e) {
        ok = false;
      }

      if (ok) {
        successes += 1;
        failures = 0;
      } else {
        failures += 1;
      }

      let newStatus = "trial";
      if (successes >= PROMOTE_AFTER_SUCCESSES) {
        // Non-default cities park at 'ready' until the city goes live —
        // promoting them to 'active' would pour their content into the
        // current city's feed (content tables aren't city-scoped yet).
        newStatus = src.city_id === "default" ? "active" : "ready";
        results.promoted++;
      } else if (failures >= DEMOTE_AFTER_FAILURES) {
        newStatus = "inactive";
        results.demoted++;
      } else {
        results.pending++;
      }

      await supabase
        .from("sources")
        .update({
          status: newStatus,
          metadata: {
            ...(src.metadata ?? {}),
            trial: {
              successes,
              failures,
              last_run_at: new Date().toISOString(),
              last_items: items,
            },
            ...(newStatus === "inactive"
              ? { retired: true, retired_reason: "auto: failed trial validation", retired_at: new Date().toISOString() }
              : {}),
          },
        })
        .eq("id", src.id);

      detail.push({ name: src.name, ok, items, successes, failures, status: newStatus });
    }

    if (results.checked > 0) {
      await supabase.from("activity_log").insert({
        actor_type: "system",
        entity_type: "system",
        action: "validate_trial_sources",
        message: `Trial validation: ${results.checked} checked, ${results.promoted} promoted, ${results.demoted} demoted`,
        details: { ...results, detail },
      });
    }

    console.log("[validate-trial-sources] Completed:", results);
    return new Response(JSON.stringify({ success: true, ...results, detail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[validate-trial-sources] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
