// Which incident sources may appear in the public, citable dataset.
//
// The rule is FAIL-CLOSED: a row is published only if its `source` value maps
// to a known source of record whose publisher we can name and, where one
// exists, link to. A source key nobody has registered here is excluded — a new
// ingester must be deliberately admitted to the citable record, never
// admitted by default.
//
// SPOTCRIME IS EXCLUDED, ALWAYS. sync-spotcrime-incidents labels its own
// material "SpotCrime (unverified aggregator)" and writes it with
// is_verified=false. It is an aggregation of unconfirmed police data that we
// have no redistribution rights to, and it is not a source of record. It is
// listed separately below so that even a future registry entry cannot admit it.

import type { CityConfig } from "../_shared/cityConfig.ts";

/** Source keys that are never published here regardless of the registry. */
export const EXCLUDED_SOURCE_KEYS = ["spotcrime"];

export type SourceSpec = {
  /** Stable key emitted as `source` in the dataset. */
  key: string;
  /** Matches the raw `incidents.source` value written by the ingester. */
  match: RegExp;
  /** Human-readable publisher, resolved per city — never hardcoded. */
  name: (c: CityConfig) => string;
  /** The publisher's official page/feed for this source, or null if none. */
  url: (c: CityConfig) => string | null;
};

function humanize(raw: string): string {
  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export const OFFICIAL_SOURCES: SourceSpec[] = [
  {
    key: "sheriff",
    match: /\bsheriff\b/i,
    name: (c) => `${c.county_name} Sheriff's Office (news releases)`,
    url: (c) => c.sheriff_press_url ?? null,
  },
  {
    key: "nws",
    match: /^nws\b|^nws[_-]|national.?weather/i,
    name: () => "NOAA National Weather Service",
    url: (c) =>
      c.nws_zones?.length
        ? `https://api.weather.gov/alerts/active?zone=${c.nws_zones.join(",")}`
        : "https://api.weather.gov/alerts/active",
  },
  {
    key: "traffic_511",
    match: /^[a-z]{0,2}[_-]?511\b|[_-]511$/i,
    name: (c) => `${c.state_code} 511 (state DOT traffic and road conditions)`,
    url: (c) => c.state_511_api_base ?? null,
  },
  {
    key: "utility_outage",
    // Utility ingesters name themselves after the utility (e.g. "we_energies"),
    // so this matches the family rather than one company.
    match: /energies|energy|electric|utility|power|outage/i,
    name: () => "Electric utility outage feed",
    url: (c) => c.utility_outage_url ?? null,
  },
];

export type ResolvedSource = {
  key: string;
  name: string;
  url: string | null;
};

/**
 * Map a raw `incidents.source` value to its publisher, or null if the row must
 * not be published. Null covers three cases: no source recorded, an explicitly
 * excluded source (SpotCrime), and an unregistered source.
 */
export function resolveSource(
  raw: string | null | undefined,
  config: CityConfig,
): ResolvedSource | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  const lower = value.toLowerCase();

  for (const banned of EXCLUDED_SOURCE_KEYS) {
    if (lower.includes(banned)) return null;
  }

  for (const spec of OFFICIAL_SOURCES) {
    if (!spec.match.test(value)) continue;
    const name =
      spec.key === "utility_outage"
        ? `${humanize(value)} (electric utility outage feed)`
        : spec.name(config);
    return { key: spec.key, name, url: spec.url(config) };
  }
  return null;
}
