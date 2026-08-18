// IndexNow submission — tell Bing (and Yandex, Seznam, Naver) the moment we publish.
//
// WHY THIS EXISTS, and why it is worth more here than a generic SEO tactic:
//
// July's referrer data said 84 of 95 search visits came from DuckDuckGo, Yahoo, Bing
// and Ecosia. All four are served by the Bing index. Google — roughly nine tenths of
// US search — sent 11. So the channel that actually delivers readers to this site is
// Bing, and Bing is the channel that supports IndexNow. A sitemap asks a crawler to
// come back and look; IndexNow tells it now, and the URL is typically indexed in
// minutes rather than days.
//
// It also compounds with the rest of the system rather than sitting beside it. This
// site publishes automatically, all day, with no operator watching. Everything it
// produces is invisible until a crawler happens to return. This closes that gap with
// no human in the loop and no per-city work — the same shape as every other fleet
// surface here.
//
// Second-order: Bing is the index behind Copilot and ChatGPT's search. Being in it
// promptly is the practical route into AI answers, which is the citation channel this
// site's editorial discipline (named sources, no stale figures) is actually suited to.
//
// THE KEY IS PUBLIC ON PURPOSE. IndexNow authenticates by requiring the key to be
// fetchable at a URL on the same host as the pages being submitted. It is an ownership
// proof, not a secret — it grants nothing but the ability to say "please recrawl this",
// so committing it is correct. public/<key>.txt must stay in sync with INDEXNOW_KEY
// below, and because it ships in the shared dist/ it is served on every city domain,
// which is exactly what the fleet needs.
//
// Invoke: POST (cron) or GET ?hours=24[&city_id=…][&dry=1]

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getActiveCityConfigs, type CityConfig } from "../_shared/cityConfig.ts";
import { containsPersonalDetail, passesIncidentGate } from "../_shared/incidentGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Must match the filename and contents of public/<key>.txt exactly. */
export const INDEXNOW_KEY = "962496e73a4476618c0816c8d4cf5000";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** IndexNow rejects batches over 10,000; stay well under and stay polite. */
const MAX_URLS = 500;

const DEFAULT_HOURS = 24;

export type CitySubmission = {
  city_id: string;
  host: string;
  urls: number;
  submitted: boolean;
  status?: number;
  error?: string;
  skipped_gated?: number;
};

/** Absolute https URL for a path on this city's own domain. */
function urlFor(config: CityConfig, path: string): string {
  const host = (config.site_domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Collect the URLs worth announcing for one city.
 *
 * Deliberately narrow: only content that genuinely changed in the window. Resubmitting
 * a stable URL set on every run is how a site teaches a crawler to ignore its pings.
 */
export async function collectUrls(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  config: CityConfig,
  sinceIso: string,
): Promise<{ urls: string[]; skippedGated: number }> {
  const urls: string[] = [];
  let skippedGated = 0;

  const { data: stories } = await supabase
    .from("content_queue")
    .select("id, title, updated_at")
    .eq("city_id", config.id)
    .in("status", ["published", "auto_published"])
    .in("safety_level", ["safe", "soft_sensitive"])
    .gte("geo_tier", 1)
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(MAX_URLS);

  for (const s of stories ?? []) {
    if (!s?.id) continue;
    urls.push(urlFor(config, `/stories/${s.id}`));
  }

  // Incidents carry the same editorial gate they carry everywhere else. The slug is
  // built from the raw title, so an ungated row would publish a name in the submission
  // payload itself — the identical bug that was found in serve-sitemap. Fail closed.
  const { data: incidents } = await supabase
    .from("incidents")
    .select("slug, title, incident_type, sub_type, location, body, ai_rewrite, updated_at")
    .eq("city_id", config.id)
    .in("status", ["active", "developing", "monitoring", "resolved"])
    .not("slug", "is", null)
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(MAX_URLS);

  for (const i of incidents ?? []) {
    if (!i?.slug) continue;
    if (!passesIncidentGate(i.title, i.incident_type, i.sub_type, i.location, i.body, i.ai_rewrite)) {
      skippedGated++;
      continue;
    }
    if (containsPersonalDetail(i.title)) {
      skippedGated++;
      continue;
    }
    urls.push(urlFor(config, `/incidents/${i.slug}`));
  }

  return { urls: urls.slice(0, MAX_URLS), skippedGated };
}

/** POST one city's batch. Never throws — a bad host must not stop the fleet. */
export async function submitBatch(
  config: CityConfig,
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ submitted: boolean; status?: number; error?: string }> {
  const host = (config.site_domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!host) return { submitted: false, error: "city has no site_domain" };

  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    // 200 accepted, 202 accepted-pending-key-validation. Both are successes.
    return { submitted: res.status === 200 || res.status === 202, status: res.status };
  } catch (e) {
    return { submitted: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const url = new URL(req.url);
  const hours = Math.min(Math.max(Number(url.searchParams.get("hours")) || DEFAULT_HOURS, 1), 168);
  const onlyCity = url.searchParams.get("city_id");
  const dryRun = url.searchParams.get("dry") === "1";
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const all = await getActiveCityConfigs(supabase);
  const cities = onlyCity ? all.filter((c) => c.id === onlyCity) : all;

  const results: CitySubmission[] = [];

  for (const config of cities) {
    // Per-city fault isolation: one bad city must never abort the rest of the fleet.
    try {
      const { urls, skippedGated } = await collectUrls(supabase, config, since);
      const host = (config.site_domain || "").replace(/^https?:\/\//, "");

      if (urls.length === 0) {
        results.push({ city_id: config.id, host, urls: 0, submitted: false, skipped_gated: skippedGated });
        continue;
      }
      if (dryRun) {
        results.push({ city_id: config.id, host, urls: urls.length, submitted: false, skipped_gated: skippedGated });
        continue;
      }

      const out = await submitBatch(config, urls);
      results.push({ city_id: config.id, host, urls: urls.length, skipped_gated: skippedGated, ...out });
    } catch (e) {
      results.push({
        city_id: config.id,
        host: config.site_domain ?? "",
        urls: 0,
        submitted: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({ since, hours, dry_run: dryRun, cities: results.length, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
