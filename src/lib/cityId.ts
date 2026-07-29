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
