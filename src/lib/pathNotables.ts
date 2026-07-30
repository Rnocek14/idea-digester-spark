// Types and payload normalisation for the notable-walks board.
//
// Split from the hook so it carries no supabase import and can be unit-tested
// directly — the same reason the almanac's normaliser lives in a lib. A panel
// that trusts the shape of an RPC payload can take down the page around it.

export type NotableWalk = {
  display_name: string | null;
  home_town: string | null;
  on_date: string | null;
  season: string | null;
  stops: number;
  temp_f?: number | null;
  crowd_mean?: number | null;
  group_size_band?: string | null;
  minutes?: number | null;
  start_hour?: number | null;
  end_hour?: number | null;
};

export type LingerRow = {
  stop_slug: string;
  stop_name: string;
  community: string | null;
  median_minutes: number | null;
  samples: number;
};

export type Notables = {
  total_walks: number;
  min_stops: number;
  season: string | null;
  community: string | null;
  hottest: NotableWalk | null;
  coldest: NotableWalk | null;
  busiest: NotableWalk | null;
  emptiest: NotableWalk | null;
  largest_group: NotableWalk | null;
  most_stops: NotableWalk | null;
  longest_outing: NotableWalk | null;
  earliest_start: NotableWalk | null;
  latest_finish: NotableWalk | null;
  linger: LingerRow[];
  seasons_available: string[];
};

/**
 * Coerce the RPC payload into something renderable, or null.
 *
 * Same lesson as the almanac: a panel that iterates a key it only assumed was
 * present can white-screen the page around it. Nothing here is worth that.
 */
export function normalizeNotables(raw: unknown): Notables | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const walk = (v: unknown): NotableWalk | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as NotableWalk) : null;
  const num = (v: unknown, f: number) => (typeof v === "number" && isFinite(v) ? v : f);

  return {
    total_walks: num(r.total_walks, 0),
    min_stops: num(r.min_stops, 2),
    season: typeof r.season === "string" ? r.season : null,
    community: typeof r.community === "string" ? r.community : null,
    hottest: walk(r.hottest),
    coldest: walk(r.coldest),
    busiest: walk(r.busiest),
    emptiest: walk(r.emptiest),
    largest_group: walk(r.largest_group),
    most_stops: walk(r.most_stops),
    longest_outing: walk(r.longest_outing),
    earliest_start: walk(r.earliest_start),
    latest_finish: walk(r.latest_finish),
    linger: Array.isArray(r.linger) ? (r.linger as LingerRow[]) : [],
    seasons_available: Array.isArray(r.seasons_available)
      ? (r.seasons_available as string[])
      : [],
  };
}
