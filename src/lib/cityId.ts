// Module-level resolved city id, kept in sync by useCityConfig (mounted on
// every page via PageShell/PublicHeader). Query functions call getCityId()
// inside queryFn — no per-component hook threading. When hostname resolution
// lands on a different city than the default, useCityConfig invalidates all
// queries so everything refetches under the correct city.

let resolvedCityId = "default";

export function getCityId(): string {
  return resolvedCityId;
}

export function setResolvedCityId(id: string): void {
  resolvedCityId = id || "default";
}

// --- Canonical site origin --------------------------------------------------
// PageMeta and the JSON-LD builders both used to hardcode
// "https://lakegenevabrief.com". On a one-city site that's invisible; on the
// fleet it is fatal. Every page of city #2 would emit rel=canonical and og:url
// pointing at city #1's domain, which tells Google city #2 is a duplicate of
// Lake Geneva and should not be indexed at all. A thousand cities would launch
// into a canonical black hole.
//
// Resolve from the actual host instead, with two guards:
//   - Local and preview hosts must never leak into a canonical. Prerendering
//     runs a real browser against 127.0.0.1, so naively trusting the hostname
//     would bake localhost into all 39 prerendered files.
//   - scripts/prerender.mjs sets window.__SITE_ORIGIN__ before the app boots so
//     prerendered HTML carries the production host.

const DEFAULT_SITE_ORIGIN = "https://lakegenevabrief.com";

/** Hosts that must never appear in a canonical URL. */
function isNonCanonicalHost(hostname: string): boolean {
  if (!hostname) return true;
  if (hostname === "localhost" || hostname.endsWith(".local")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // Platform preview domains: real, reachable, and must not self-canonicalize.
  return /\.(lovable\.app|lovableproject\.com|vercel\.app|netlify\.app|pages\.dev)$/.test(
    hostname,
  );
}

/**
 * The origin this page should present as canonical — scheme + host, no trailing
 * slash. Safe to call during prerender and in non-browser contexts.
 */
export function getSiteOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_SITE_ORIGIN;

  const override = (window as unknown as { __SITE_ORIGIN__?: string }).__SITE_ORIGIN__;
  if (override) return override.replace(/\/+$/, "");

  const { hostname, protocol, host } = window.location;
  if (isNonCanonicalHost(hostname)) return DEFAULT_SITE_ORIGIN;
  return `${protocol}//${host}`;
}

// --- Fail-open city scoping -------------------------------------------------
// The frontend can deploy before the city_id migrations land. Filtering on a
// column that doesn't exist yet makes PostgREST return an error, which the UI
// would otherwise render as "no stories" — a silently empty site. So scoping
// degrades: the first missing-column error disables it process-wide and the
// query is retried unscoped. With one live city that is exactly correct, and
// it re-enables itself on the next page load once the migration is applied.

let cityScopingEnabled = true;

export function isCityScopingEnabled(): boolean {
  return cityScopingEnabled;
}

/** True when an error means the content tables aren't city-scoped yet. */
export function isMissingCityColumn(error: unknown): boolean {
  const err = error as { message?: string; code?: string } | null;
  const msg = String(err?.message ?? "");
  if (!/city_id/i.test(msg)) return false;
  return /does not exist|schema cache|column|unknown/i.test(msg) || err?.code === "42703";
}

/**
 * Apply the city filter only when scoping is active. Lets a call site keep its
 * existing query chain intact: maybeCity(supabase.from(x).select(y), scoped).
 */
export function maybeCity<T>(query: T, scoped: boolean): T {
  if (!scoped) return query;
  return (query as { eq: (c: string, v: string) => T }).eq("city_id", resolvedCityId);
}

/**
 * Run a query that may be city-scoped. `build(scoped)` must construct the query
 * fresh each call so it can be retried without the city filter.
 */
export async function runCityScoped<T>(
  build: (scoped: boolean) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  const result = await build(cityScopingEnabled);
  if (result.error && cityScopingEnabled && isMissingCityColumn(result.error)) {
    cityScopingEnabled = false;
    console.warn(
      "[cityId] content tables are not city-scoped yet — disabling city filters " +
        "for this session. Apply the city_id migrations to re-enable.",
    );
    return await build(false);
  }
  return result;
}
