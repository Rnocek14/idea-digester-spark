// bootstrap-city: given a city, automatically build its config + candidate
// source list. This is the city template's ignition switch.
//
// Discovery is NEVER trusted directly: everything this function finds enters
// as status='trial' and only goes live after validate-trial-sources observes
// it repeatedly returning real items (see docs/city-bootstrap-sop.md).
//
// Tiers implemented here:
//   T1 deterministic APIs: NWS zones (computed from lat/lon), state 511
//      registry, SpotCrime county path, Google News RSS (discovery-layer).
//   T2 pattern probes: CivicPlus/CivicEngage endpoints on the city .gov,
//      WordPress-style feed paths on news domains found via Firecrawl search.
//   T3 AI gazetteer expansion (OpenAI, fail-open to deterministic base).
//
// Auth: requireAdmin (operator- or automation-triggered, never public).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NWS_USER_AGENT = "CityBrief bootstrap (contact: newsletter@citybrief.info)";
const PROBE_TIMEOUT_MS = 6000;

const STATE_NAMES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire",
  NJ: "new-jersey", NM: "new-mexico", NY: "new-york", NC: "north-carolina",
  ND: "north-dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode-island", SC: "south-carolina", SD: "south-dakota", TN: "tennessee",
  TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

// States with a known machine-readable 511 API compatible with sync-511-traffic's
// endpoint shape. Expand as new states are onboarded and verified.
const STATE_511_REGISTRY: Record<string, string> = {
  WI: "https://511wi.gov/api",
};

const DOMAIN_BLOCKLIST = [
  "google.", "facebook.", "youtube.", "wikipedia.", "twitter.", "x.com",
  "instagram.", "tiktok.", "yelp.", "tripadvisor.", "zillow.", "realtor.",
  "linkedin.", "reddit.", "patch.com", "nextdoor.", "apple.", "amazon.",
];

const FEED_PATHS = ["/feed/", "/feed", "/rss", "/rss.xml", "/?feed=rss2", "/feeds/news.xml"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xml,application/rss+xml,*/*",
        ...(init.headers ?? {}),
      },
    });
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 2000).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf");
}

function countFeedItems(text: string): number {
  return (text.match(/<item[\s>]/gi) || []).length + (text.match(/<entry[\s>]/gi) || []).length;
}

async function probeFeed(url: string): Promise<{ ok: boolean; items: number }> {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return { ok: false, items: 0 };
  const text = await res.text().catch(() => "");
  if (!looksLikeFeed(text)) return { ok: false, items: 0 };
  return { ok: true, items: countFeedItems(text) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const cityName: string = (body.city_name || "").trim();
    const stateCode: string = (body.state_code || "").trim().toUpperCase();
    const countyName: string = (body.county_name || "").trim();
    if (!cityName || !stateCode || !countyName) {
      return new Response(
        JSON.stringify({ error: "city_name, state_code, county_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cityId = body.city_id || `${slugify(cityName)}-${stateCode.toLowerCase()}`;
    const report: Record<string, unknown> = { city_id: cityId };
    const sourcesToInsert: Array<Record<string, unknown>> = [];

    // --- Geocode (open-meteo, no key) ---
    let lat: number | undefined = body.lat;
    let lon: number | undefined = body.lon;
    if (typeof lat !== "number" || typeof lon !== "number") {
      const geoRes = await fetchWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`
      );
      const geo = geoRes && geoRes.ok ? await geoRes.json().catch(() => null) : null;
      const match = geo?.results?.find(
        (r: { admin1?: string; country_code?: string }) =>
          r.country_code === "US" &&
          (r.admin1 || "").toLowerCase() === (STATE_NAMES[stateCode] || "").replace(/-/g, " ")
      ) ?? geo?.results?.[0];
      if (!match) {
        return new Response(
          JSON.stringify({ error: `Could not geocode ${cityName}, ${stateCode} — pass lat/lon explicitly` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      lat = match.latitude;
      lon = match.longitude;
    }
    report.geocode = { lat, lon };

    // --- NWS zones from lat/lon (deterministic, fully automatic) ---
    let nwsZones: string[] = [];
    const nwsRes = await fetchWithTimeout(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
    });
    if (nwsRes?.ok) {
      const points = await nwsRes.json().catch(() => null);
      const zoneUrl: string | undefined = points?.properties?.forecastZone;
      const countyUrl: string | undefined = points?.properties?.county;
      nwsZones = [zoneUrl, countyUrl]
        .filter(Boolean)
        .map((u: string) => u.split("/").pop()!)
        .filter((z: string) => /^[A-Z]{2}[CZ]\d{3}$/.test(z));
    }
    report.nws_zones = nwsZones;

    // --- Bbox ---
    const radius = typeof body.bbox_radius_deg === "number" ? body.bbox_radius_deg : 0.18;
    const bbox = {
      minLat: lat! - radius,
      maxLat: lat! + radius,
      minLon: lon! - radius * 1.3,
      maxLon: lon! + radius * 1.3,
    };

    // --- Gazetteer: deterministic base + optional AI expansion (fail-open) ---
    const countyBase = countyName.replace(/\s*county\s*$/i, "").trim();
    const baseKeywords = new Set<string>(
      [cityName, countyBase, `${countyBase} county`, ...(body.extra_keywords ?? [])]
        .map((k: string) => k.toLowerCase().trim())
        .filter(Boolean)
    );
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You produce geographic gazetteer keywords for local-news filtering. Only include REAL place names you are certain exist. Never invent names.",
              },
              {
                role: "user",
                content: `List towns, villages, unincorporated communities, lakes, and major named highways within or directly adjacent to ${countyName}, ${(STATE_NAMES[stateCode] ?? stateCode).replace(/-/g, " ")} (near ${cityName}). Also list the 3-5 nearest large metro cities OUTSIDE the county (for exclusion filtering). Respond as JSON: {"local": ["..."], "non_local_metros": ["..."]}`,
              },
            ],
            temperature: 0,
          }),
        });
        if (aiRes.ok) {
          const ai = await aiRes.json();
          const parsed = JSON.parse(ai.choices?.[0]?.message?.content ?? "{}");
          for (const k of parsed.local ?? []) {
            if (typeof k === "string" && k.length > 2 && k.length < 40) baseKeywords.add(k.toLowerCase().trim());
          }
          report.non_local_metros = (parsed.non_local_metros ?? [])
            .filter((k: unknown) => typeof k === "string")
            .map((k: string) => k.toLowerCase().trim());
        }
      } catch (e) {
        report.gazetteer_ai_error = String(e);
      }
    }
    const localKeywords = [...baseKeywords];
    const nonLocalKeywords = (report.non_local_metros as string[] | undefined) ?? [];
    report.local_keywords = localKeywords;

    // --- Insert city_config (status=bootstrapping; goes active only at launch) ---
    const { error: cityErr } = await supabase.from("city_config").insert({
      id: cityId,
      city_name: cityName,
      state_code: stateCode,
      county_name: countyName,
      timezone: body.timezone || "America/Chicago",
      latitude: lat,
      longitude: lon,
      bbox,
      local_keywords: localKeywords,
      non_local_keywords: nonLocalKeywords,
      nws_zones: nwsZones,
      state_511_api_base: STATE_511_REGISTRY[stateCode] ?? null,
      spotcrime_path: `${stateCode}/${encodeURIComponent(countyName)}`,
      sheriff_press_url: null,
      utility_outage_url: null,
      site_domain: body.site_domain || `${slugify(cityName)}brief.com`,
      site_name: `${cityName} Brief`,
      from_email: body.from_email || "newsletter@citybrief.info",
      breaking_from_email: body.breaking_from_email || "breaking@citybrief.info",
      hostname: body.site_domain || null,
      status: "bootstrapping",
    });
    if (cityErr && !cityErr.message.includes("duplicate")) {
      throw new Error(`city_config insert failed: ${cityErr.message}`);
    }
    report.city_config = cityErr ? "already existed" : "created";

    const { data: runRow } = await supabase
      .from("source_discovery_runs")
      .insert({ city_id: cityId, status: "running" })
      .select("id")
      .single();

    // --- T1: Google News RSS (discovery layer — can never auto-publish) ---
    sourcesToInsert.push({
      city_id: cityId,
      name: `Google News – ${cityName} (discovery)`,
      type: "rss",
      url: `https://news.google.com/rss/search?q=%22${encodeURIComponent(cityName)}%22%20${encodeURIComponent((STATE_NAMES[stateCode] ?? stateCode).replace(/-/g, " "))}&hl=en-US&gl=US&ceid=US:en`,
      category: "news",
      status: "trial",
      fetch_frequency_minutes: 180,
      default_geo_tier: 2,
      metadata: { discovery_layer: "true", bootstrap: true, tier: "T1" },
    });

    // --- T1: patch.com presence probe ---
    const stateName = STATE_NAMES[stateCode];
    if (stateName) {
      const patchUrl = `https://patch.com/${stateName}/${slugify(cityName)}`;
      const patchRes = await fetchWithTimeout(patchUrl);
      report.patch = patchRes?.ok ? "present" : "absent";
      if (patchRes?.ok) {
        sourcesToInsert.push({
          city_id: cityId,
          name: `Patch – ${cityName}`,
          type: "scrape",
          url: patchUrl,
          category: "news",
          status: "candidate", // scrape sources need per-site adaptation; flagged, not auto-validated
          fetch_frequency_minutes: 180,
          default_geo_tier: 1,
          metadata: { bootstrap: true, tier: "T1", note: "wire to sync-patch pattern at launch" },
        });
      }
    }

    // --- T2: city government CMS probes (CivicPlus/CivicEngage pattern) ---
    const citySlugCompact = slugify(cityName).replace(/-/g, "");
    const govBases = [
      `https://www.cityof${citySlugCompact}.gov`,
      `https://cityof${citySlugCompact}.gov`,
      `https://www.cityof${citySlugCompact}.org`,
      `https://www.${citySlugCompact}${stateCode.toLowerCase()}.gov`,
      `https://www.${citySlugCompact}.gov`,
    ];
    const govResults = await Promise.allSettled(
      govBases.map(async (base) => {
        const res = await fetchWithTimeout(base);
        return res?.ok ? base : null;
      })
    );
    const liveGovBases = govResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean) as string[];
    report.gov_bases_found = liveGovBases;

    for (const base of liveGovBases.slice(0, 2)) {
      const alertsUrl = `${base}/CivicAlerts.aspx?Format=RSS`;
      const probe = await probeFeed(alertsUrl);
      if (probe.ok) {
        sourcesToInsert.push({
          city_id: cityId,
          name: `City of ${cityName} – Civic Alerts`,
          type: "rss",
          url: alertsUrl,
          category: "civic",
          status: "trial",
          fetch_frequency_minutes: 120,
          default_geo_tier: 1,
          metadata: { bootstrap: true, tier: "T2", trusted_source: true, probe_items: probe.items },
        });
      }
    }

    // --- T2: news-domain feed probes via Firecrawl search (graceful skip) ---
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey) {
      try {
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${cityName} ${stateName ?? stateCode} local news`, limit: 8 }),
        });
        if (searchRes.ok) {
          const search = await searchRes.json();
          const domains = new Set<string>();
          for (const r of search.data ?? []) {
            try {
              const host = new URL(r.url).hostname.replace(/^www\./, "");
              if (!DOMAIN_BLOCKLIST.some((b) => host.includes(b))) domains.add(host);
            } catch { /* skip bad URLs */ }
          }
          report.news_domains_searched = [...domains];
          for (const host of [...domains].slice(0, 5)) {
            const probes = await Promise.allSettled(
              FEED_PATHS.map(async (p) => {
                const url = `https://${host}${p}`;
                const probe = await probeFeed(url);
                return probe.ok && probe.items > 0 ? { url, items: probe.items } : null;
              })
            );
            const hit = probes
              .map((r) => (r.status === "fulfilled" ? r.value : null))
              .filter(Boolean)[0] as { url: string; items: number } | undefined;
            if (hit) {
              sourcesToInsert.push({
                city_id: cityId,
                name: `${host} (discovered)`,
                type: "rss",
                url: hit.url,
                category: "news",
                status: "trial",
                fetch_frequency_minutes: 120,
                default_geo_tier: 1,
                metadata: { bootstrap: true, tier: "T2", probe_items: hit.items },
              });
            }
          }
        }
      } catch (e) {
        report.firecrawl_error = String(e);
      }
    } else {
      report.firecrawl = "skipped (no FIRECRAWL_API_KEY)";
    }

    // --- Insert all discovered sources (url-unique; re-runs are no-ops) ---
    let inserted = 0;
    for (const s of sourcesToInsert) {
      const { error } = await supabase.from("sources").upsert(s, { onConflict: "url", ignoreDuplicates: true });
      if (!error) inserted++;
      else report[`source_error_${s.name}`] = error.message;
    }
    report.sources_discovered = sourcesToInsert.map((s) => ({ name: s.name, url: s.url, status: s.status }));
    report.sources_inserted = inserted;

    if (runRow) {
      await supabase
        .from("source_discovery_runs")
        .update({ status: "completed", finished_at: new Date().toISOString(), report })
        .eq("id", runRow.id);
    }

    return new Response(JSON.stringify({ success: true, ...report }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bootstrap-city] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
