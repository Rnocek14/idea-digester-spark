// serve-data — the citable, machine-readable per-city incident record.
//
// WHY THIS EXISTS
// ---------------
// The one asset here that cannot be forked is a growing structured record of a
// small town, produced by ~100 ingestion functions. Until now it was invisible:
// every incident page is client-rendered, so GPTBot, ClaudeBot, PerplexityBot
// and OAI-SearchBot — none of which execute JavaScript — see an empty
// <div id="root">. This endpoint serves the record as data, and describes it
// with schema.org/Dataset JSON-LD so it is eligible for Google Dataset Search:
// a real, free, indexed surface that local news essentially does not use.
//
// THE EDITORIAL CONSTRAINT THAT SHAPES EVERY DECISION BELOW
// --------------------------------------------------------
// This dataset publishes PROVENANCE, NEVER COUNTS.
//
// The editorial gate in _shared/incidentGate.ts auto-rejects arrest, charged,
// domestic, overdose, suicide, fatality and juvenile material, and holds
// shots-fired, armed and missing-person material. The record is therefore
// SYSTEMATICALLY CENSORED in exactly the categories a reporter would want to
// cite. Any count computed from it — incidents per month, a crime rate, a
// year-over-year trend — would imply a completeness this data does not have and
// would make the town look safer than the official record. So:
//
//   * No totals, no counts, no aggregates are published. Not in the payload,
//     not in the headers, not in the JSON-LD.
//   * Every response carries a machine-readable notice saying counts derived
//     from it are invalid.
//   * A database error returns 503, never an empty array — "zero rows" would
//     read as "zero incidents".
//
// Per record we publish: slug, title, incident_type, status, started_at,
// resolved_at, a geographic label, the source of record, and the publisher's
// official URL where one exists. Nothing else.
//
// Fleet-safe: the city is resolved from ?city_id= or the Host header against
// city_config. No domain, city name or city id is hardcoded anywhere here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CityConfig } from "../_shared/cityConfig.ts";
import { resolveCityConfig } from "../_shared/renderPage.ts";
import {
  containsPersonalDetail,
  redactForPublicRender,
  tier3Match,
  tier4Match,
} from "../_shared/incidentGate.ts";
import { EXCLUDED_SOURCE_KEYS, resolveSource } from "./sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Statuses a member of the public can already see on the site. Anything in
// review, rejected or marked a false alarm stays out of the citable record.
const PUBLIC_STATUSES = ["active", "developing", "monitoring", "resolved"];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_PAGE = 500;

// Repeated verbatim in the JSON payloads, the CSV headers and the Dataset
// JSON-LD description, so a human and a machine see the same warning.
const EXCLUSION_NOTICE =
  "INCOMPLETE BY DESIGN — DO NOT COUNT. This dataset is a provenance index, not " +
  "a crime statistic. Records are omitted by a published editorial gate that " +
  "removes material mentioning arrest, charges, domestic incidents, overdose, " +
  "suicide, fatality or juveniles, and withholds shots-fired, armed-subject and " +
  "missing-person material from automatic publication. Records sourced from " +
  "SpotCrime, an unverified commercial aggregator, are excluded entirely. Any " +
  "count, rate or trend calculated from this dataset will understate the " +
  "official record and must not be published as a measure of crime or safety. " +
  "Use it to locate and cite individual documented events, and verify each one " +
  "against the named source of record.";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

type IncidentRow = {
  slug: string | null;
  title: string | null;
  incident_type: string | null;
  sub_type: string | null;
  status: string | null;
  started_at: string | null;
  resolved_at: string | null;
  location: string | null;
  source: string | null;
  body: string | null;
  ai_rewrite: string | null;
  original_body: string | null;
};

type DataRecord = {
  slug: string;
  title: string;
  incident_type: string;
  status: string;
  started_at: string | null;
  resolved_at: string | null;
  geo_label: string | null;
  source: string;
  source_name: string;
  source_url: string | null;
  url: string;
};

// ---------------------------------------------------------------------------
// City resolution is the SHARED helper in _shared/renderPage.ts — the same one
// serve-page, serve-feed, serve-llms and serve-robots use, so every public
// surface answers "which city is this?" identically (?city_id=, then the
// Host/X-Forwarded-Host header, then the template city).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Record construction
// ---------------------------------------------------------------------------

/**
 * Turn a raw incident row into a publishable record, or null if it must not be
 * published. Three independent reasons to drop a row:
 *   1. Its source is not a registered source of record (fail-closed), or is
 *      SpotCrime (always excluded).
 *   2. Any of its text trips the tier-4 or tier-3 editorial gate. The gate runs
 *      over the body text too, even though the body is never published — a row
 *      whose narrative mentions an arrest does not belong in the record at all.
 *   3. It has no slug, so it has no citable canonical URL.
 *   4. Its title contains a personal detail. Redacting the title is NOT enough:
 *      the ingesters compute `incidents.slug` as slugify(RAW title), so a title
 *      needing redaction has a slug that still spells the name, the house
 *      number or the phone number out in full — and the slug is published, and
 *      is baked into the record's canonical `url`. Redacting the slug is not an
 *      option because it would no longer address anything. Fail closed instead.
 */
function toRecord(row: IncidentRow, config: CityConfig): DataRecord | null {
  if (!row.slug) return null;

  const source = resolveSource(row.source, config);
  if (!source) return null;

  const gateText = [
    row.title,
    row.incident_type,
    row.sub_type,
    row.location,
    row.body,
    row.ai_rewrite,
    row.original_body,
  ]
    .filter(Boolean)
    .join(" ");
  if (tier4Match(gateText) || tier3Match(gateText)) return null;

  // The slug is derived upstream from the UNREDACTED title and is published as
  // both `slug` and `url`. If the title needs redacting, the slug leaks exactly
  // what the redactor just removed, so the whole record is withheld.
  if (containsPersonalDetail(row.title)) return null;

  const title = redactForPublicRender(row.title);
  if (!title) return null;
  const geoLabel = row.location ? redactForPublicRender(row.location) : null;

  return {
    slug: row.slug,
    title,
    incident_type: row.incident_type || "other",
    status: row.status || "unknown",
    started_at: row.started_at,
    resolved_at: row.resolved_at,
    geo_label: geoLabel || null,
    source: source.key,
    source_name: source.name,
    source_url: source.url,
    url: `https://${config.site_domain}/incidents/${row.slug}`,
  };
}

function parsePaging(url: URL): { page: number; limit: number; offset: number } {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const rawPage = Number.parseInt(url.searchParams.get("page") || "", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, MAX_PAGE) : 1;
  return { page, limit, offset: (page - 1) * limit };
}

type FetchResult =
  | { ok: true; records: DataRecord[]; windowFull: boolean }
  | { ok: false; message: string };

async function fetchRecords(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  config: CityConfig,
  offset: number,
  limit: number,
): Promise<FetchResult> {
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "slug,title,incident_type,sub_type,status,started_at,resolved_at,location,source,body,ai_rewrite,original_body",
    )
    .eq("city_id", config.id)
    .in("status", PUBLIC_STATUSES)
    .not("slug", "is", null)
    // Belt and braces: SpotCrime is also dropped in resolveSource(), but there
    // is no reason to pull it over the wire.
    .not("source", "in", `(${EXCLUDED_SOURCE_KEYS.join(",")})`)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { ok: false, message: error.message || "query failed" };

  const rows = (data ?? []) as IncidentRow[];
  const records: DataRecord[] = [];
  for (const row of rows) {
    const rec = toRecord(row, config);
    if (rec) records.push(rec);
  }
  // A full window means there is more of the underlying record to page through.
  // Note this is a property of the WINDOW, not of the published rows: filtering
  // happens after retrieval, so a page can legitimately return fewer records
  // than the window size — or none — while more pages remain.
  return { ok: true, records, windowFull: rows.length >= limit };
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

const CSV_COLUMNS: Array<keyof DataRecord> = [
  "slug",
  "title",
  "incident_type",
  "status",
  "started_at",
  "resolved_at",
  "geo_label",
  "source",
  "source_name",
  "source_url",
  "url",
];

/** RFC 4180 quoting, plus neutralisation of spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // A leading =, +, -, @ or a tab/CR makes Excel and Sheets evaluate the cell.
  // The minus sign matters as much as the equals sign: "-2+3+cmd|'…'!A0" is the
  // canonical DDE payload and a title may legitimately start with a dash.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Reduce a DB-supplied id to characters that are safe inside a quoted header. */
function filenameSafe(raw: string): string {
  return String(raw ?? "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "city";
}

function toCsv(records: DataRecord[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of records) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  }
  // Trailing newline so `wc -l` and streaming parsers behave.
  return lines.join("\r\n") + "\r\n";
}

/**
 * The base URL these endpoints are actually reachable at, derived from the live
 * request rather than assumed. Google Dataset Search discards a Dataset whose
 * distribution contentUrls do not resolve, and the function is reachable both
 * directly (…/functions/v1/serve-data/…) and, where a host rewrite exists, at
 * /data/… on the city's own domain. Echoing the request keeps the advertised
 * URLs identical to the one that just worked.
 */
function endpointBase(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || (url.protocol === "http:" ? "http" : "https");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const path = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/(incidents\.csv|incidents\.json|incidents|dataset\.json|dataset)$/i, "");
  return `${proto}://${host}${path}`;
}

/**
 * The query string that must be carried on every advertised URL so that URL
 * resolves to the SAME city this response describes.
 *
 * When a request arrives on a city's own domain the Host header alone resolves
 * the city, so a bare URL is already correct. When it arrives with an explicit
 * ?city_id= — which is how the endpoints are reachable on the shared functions
 * host, and how serve-robots/serve-sitemap address them — dropping the param
 * from the advertised contentUrls would point Dataset Search at a Dataset whose
 * distributions serve a DIFFERENT city's records, and would give every city's
 * Dataset the same @id. Echo the RESOLVED id, not the raw param, so a bogus
 * value cannot propagate.
 */
function cityQuery(req: Request, config: CityConfig): string {
  const raw = new URL(req.url).searchParams.get("city_id");
  return raw ? `?city_id=${encodeURIComponent(config.id)}` : "";
}

function buildDataset(
  config: CityConfig,
  base: string,
  q: string,
  coverage: { earliest: string | null; latest: string | null },
): Record<string, unknown> {
  const place = `${config.city_name}, ${config.state_code}`;
  const bbox = config.bbox;

  // temporalCoverage is derived from the earliest and latest records actually
  // present. It is an open interval when the record is still being added to.
  const temporal = coverage.earliest
    ? `${coverage.earliest.slice(0, 10)}/${coverage.latest ? coverage.latest.slice(0, 10) : ".."}`
    : null;

  return {
    "@context": "https://schema.org/",
    "@type": "Dataset",
    "@id": `${base}/dataset.json${q}`,
    name: `${place} local incident record — ${config.site_name}`,
    alternateName: `${place} incidents (provenance index)`,
    description: EXCLUSION_NOTICE,
    url: `https://${config.site_domain}/incidents`,
    sameAs: `${base}/dataset.json${q}`,
    version: "1",
    isAccessibleForFree: true,
    // Honest self-description: schema.org has a vocabulary for this and there
    // is no reason to hide behind it.
    creativeWorkStatus: "Incomplete — filtered by a published editorial policy",
    license: LICENSE_URL,
    conditionsOfAccess:
      "Free to use and redistribute with attribution to " +
      `${config.site_name} (${config.site_domain}). Verify each record against ` +
      "the named source of record before publication.",
    creator: {
      "@type": "Organization",
      name: config.site_name,
      url: `https://${config.site_domain}`,
    },
    publisher: {
      "@type": "Organization",
      name: config.site_name,
      url: `https://${config.site_domain}`,
    },
    ...(temporal ? { temporalCoverage: temporal } : {}),
    spatialCoverage: {
      "@type": "Place",
      name: `${place} and ${config.county_name}`,
      geo: [
        {
          "@type": "GeoCoordinates",
          latitude: config.latitude,
          longitude: config.longitude,
        },
        {
          "@type": "GeoShape",
          box: `${bbox.minLat} ${bbox.minLon} ${bbox.maxLat} ${bbox.maxLon}`,
        },
      ],
    },
    keywords: [
      place,
      config.county_name,
      "local incidents",
      "public safety records",
      "traffic",
      "weather alerts",
      "utility outages",
      "local news",
    ],
    measurementTechnique:
      "Automated ingestion from named public sources of record (county sheriff " +
      "news releases, NOAA/National Weather Service alerts, state DOT 511 " +
      "traffic feeds, electric utility outage feeds), filtered by a keyword " +
      "editorial gate and a deterministic personal-detail redactor before " +
      "publication. No record is included from an unverified aggregator.",
    variableMeasured: [
      { "@type": "PropertyValue", name: "slug", description: "Stable identifier and URL path segment for the record." },
      { "@type": "PropertyValue", name: "title", description: "Short description of the event, personal details redacted." },
      { "@type": "PropertyValue", name: "incident_type", description: "Coarse category, e.g. weather, traffic, utility, fire." },
      { "@type": "PropertyValue", name: "status", description: "One of active, developing, monitoring, resolved." },
      { "@type": "PropertyValue", name: "started_at", description: "ISO 8601 timestamp the event was first recorded as beginning." },
      { "@type": "PropertyValue", name: "resolved_at", description: "ISO 8601 timestamp the event was recorded as resolved, if it was." },
      { "@type": "PropertyValue", name: "geo_label", description: "Coarse geographic label. Exact street numbers are reduced to hundred-blocks." },
      { "@type": "PropertyValue", name: "source", description: "Source-of-record key: sheriff, nws, traffic_511, utility_outage." },
      { "@type": "PropertyValue", name: "source_name", description: "Named publisher of the underlying record." },
      { "@type": "PropertyValue", name: "source_url", description: "The publisher's official page or feed, where one exists. Not a permalink to the individual record." },
      { "@type": "PropertyValue", name: "url", description: "Canonical page for this record on the publishing site." },
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${base}/incidents.json${q}`,
        description: "Paginated JSON. ?page= and ?limit= (maximum 200).",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${base}/incidents.csv${q}`,
        description: "Same records as CSV, RFC 4180 quoted. ?page= and ?limit= (maximum 200).",
      },
    ],
    // Deliberately absent: any count, total, size or rate. See description.
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

type Route = "incidents.json" | "incidents.csv" | "dataset.json" | "index";

function routeFor(url: URL): Route {
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  const format = (url.searchParams.get("format") || "").toLowerCase();
  if (path.endsWith("incidents.csv") || (path.endsWith("incidents") && format === "csv")) {
    return "incidents.csv";
  }
  if (path.endsWith("incidents.json") || path.endsWith("incidents")) return "incidents.json";
  if (path.endsWith("dataset.json") || path.endsWith("dataset")) return "dataset.json";
  return "index";
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Dataset-Notice": "incomplete-by-design; counts invalid; see description",
      ...extraHeaders,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const route = routeFor(url);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const config = await resolveCityConfig(supabase, req);
    const base = endpointBase(req);
    const q = cityQuery(req, config);

    if (route === "index") {
      return jsonResponse({
        name: `${config.site_name} open data`,
        notice: EXCLUSION_NOTICE,
        license: LICENSE_URL,
        endpoints: {
          "incidents.json": `${base}/incidents.json${q}`,
          "incidents.csv": `${base}/incidents.csv${q}`,
          "dataset.json": `${base}/dataset.json${q}`,
        },
      });
    }

    if (route === "dataset.json") {
      // Coverage bounds come from the same DB-level filters as the data itself.
      // They are the range of the underlying record; individual events inside
      // that range are absent wherever the editorial gate removed them, which
      // is exactly why the description forbids counting.
      const bounds = async (ascending: boolean) => {
        const { data } = await supabase
          .from("incidents")
          .select("started_at")
          .eq("city_id", config.id)
          .in("status", PUBLIC_STATUSES)
          .not("source", "in", `(${EXCLUDED_SOURCE_KEYS.join(",")})`)
          .order("started_at", { ascending })
          .limit(1);
        const row = (data ?? [])[0] as { started_at?: string } | undefined;
        return row?.started_at ?? null;
      };
      const earliest = await bounds(true);
      const latest = await bounds(false);

      return jsonResponse(buildDataset(config, base, q, { earliest, latest }), 200, {
        "Content-Type": "application/ld+json; charset=utf-8",
      });
    }

    const { page, limit, offset } = parsePaging(url);
    const result = await fetchRecords(supabase, config, offset, limit);

    if (!result.ok) {
      // Never serve an empty dataset on error: "no rows" reads as "no
      // incidents", which is precisely the false impression this endpoint is
      // built to avoid.
      console.error("[serve-data] query failed:", result.message);
      return jsonResponse(
        { error: "dataset temporarily unavailable", detail: "upstream query failed" },
        503,
        { "Cache-Control": "no-store" },
      );
    }

    const nextPage = result.windowFull && page < MAX_PAGE ? page + 1 : null;

    if (route === "incidents.csv") {
      return new Response(toCsv(result.records), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          // config.id is DB-supplied and lands inside a quoted header
          // parameter, so it is reduced to slug characters rather than
          // interpolated raw — a quote or semicolon would silently truncate
          // the filename a client sees.
          "Content-Disposition": `inline; filename="${filenameSafe(config.id)}-incidents-page-${page}.csv"`,
          "Cache-Control": "public, max-age=3600",
          // Points at the Link header below rather than a hardcoded /data path,
          // which does not exist when the function is called on the shared
          // functions host.
          "X-Dataset-Notice": "incomplete-by-design; counts invalid; see Link rel=describedby",
          "X-Dataset-License": LICENSE_URL,
          ...(nextPage ? { "X-Next-Page": String(nextPage) } : {}),
          Link: `<${base}/dataset.json${q}>; rel="describedby"; type="application/ld+json"`,
        },
      });
    }

    return jsonResponse(
      {
        // The notice is the first key so it is the first thing a human sees in
        // a raw response and the first thing a model reads in the token stream.
        notice: EXCLUSION_NOTICE,
        dataset: `${base}/dataset.json${q}`,
        license: LICENSE_URL,
        attribution: `${config.site_name} (https://${config.site_domain})`,
        city: {
          id: config.id,
          name: config.city_name,
          state: config.state_code,
          county: config.county_name,
        },
        page,
        limit,
        next_page: nextPage,
        // Deliberately no total: see notice.
        records: result.records,
      },
      200,
      {
        Link: `<${base}/dataset.json${q}>; rel="describedby"; type="application/ld+json"`,
        "X-Dataset-License": LICENSE_URL,
      },
    );
  } catch (error) {
    console.error("[serve-data] Error:", error);
    return jsonResponse({ error: "dataset temporarily unavailable" }, 503, {
      "Cache-Control": "no-store",
    });
  }
});
