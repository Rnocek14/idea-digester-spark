// Display formatting for the Shore Path Almanac.
//
// Split out from the hook so it carries no React or Supabase import and can be
// unit-tested directly, the same way src/lib/cityDistance.ts is. The crowd label
// is the one bit of index arithmetic on the page, and an off-by-one here would
// mislabel how busy the path is in published copy.

export type HourBucket = "dawn" | "morning" | "midday" | "afternoon" | "evening";
export type SeasonBucket = "spring" | "summer" | "fall" | "winter";

export const HOUR_BUCKETS: HourBucket[] = ["dawn", "morning", "midday", "afternoon", "evening"];
export const SEASON_BUCKETS: SeasonBucket[] = ["spring", "summer", "fall", "winter"];

export const HOUR_LABELS: Record<HourBucket, string> = {
  dawn: "Before 8",
  morning: "8–11",
  midday: "11–2",
  afternoon: "2–5",
  evening: "After 5",
};

export const SEASON_LABELS: Record<SeasonBucket, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

/**
 * Crowd means arrive from SQL on a 0–2 scale (empty 0, some 1, busy 2), because
 * averaging a three-way choice is the only way to summarise it.
 */
export const CROWD_WORDS = ["Empty", "Quiet", "Some", "Steady", "Busy"] as const;

export function crowdWord(mean: number | null | undefined): string {
  if (mean == null || !isFinite(mean)) return "—";
  const clamped = Math.min(2, Math.max(0, mean));
  const i = Math.round((clamped / 2) * (CROWD_WORDS.length - 1));
  return CROWD_WORDS[i];
}

/**
 * Sequential shading, not a red/green verdict — a busy path is not a bad path,
 * it's just information for someone deciding when to go.
 */
export function crowdShade(mean: number | null | undefined): string {
  if (mean == null || !isFinite(mean)) return "bg-stone-50 text-slate-400 border-slate-200";
  if (mean < 0.4) return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (mean < 0.9) return "bg-lime-50 text-lime-900 border-lime-200";
  if (mean < 1.4) return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-orange-100 text-orange-950 border-orange-300";
}

export type SeasonHourCell = {
  season: SeasonBucket;
  hour_bucket: HourBucket;
  samples: number;
  crowd_mean: number | null;
  temp_median: number | null;
};

export type SeasonDayTypeCell = {
  season: SeasonBucket;
  day_type: "weekday" | "weekend";
  samples: number;
  crowd_mean: number | null;
};

export type CommunityCell = {
  community: string;
  samples: number;
  crowd_mean: number | null;
  temp_median: number | null;
};

export type Almanac = {
  min_samples: number;
  total_visits: number;
  total_with_crowd: number;
  by_season_hour: SeasonHourCell[];
  by_season_daytype: SeasonDayTypeCell[];
  by_community: CommunityCell[];
  quietest: {
    season: SeasonBucket;
    hour_bucket: HourBucket;
    day_type: "weekday" | "weekend";
    samples: number;
    crowd_mean: number | null;
  } | null;
  warmest: {
    season: SeasonBucket;
    hour_bucket: HourBucket;
    samples: number;
    temp_median: number | null;
  } | null;
};

/**
 * Coerce whatever the RPC returned into a shape the UI can render, or null.
 *
 * This is not defensive paranoia — it is a fix. The component iterated
 * `data.by_season_hour` after only checking that `data` was truthy, so a
 * response that was an object or array without that key threw
 * "by_season_hour is not iterable" and took the whole guide page down with it.
 * The almanac is a panel on the site's best page; it is never worth a white
 * screen, so a malformed payload degrades to "not enough data yet" instead.
 */
export function normalizeAlmanac(raw: unknown): Almanac | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && isFinite(v) ? v : fallback;
  const obj = <T,>(v: unknown): T | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;

  return {
    min_samples: num(r.min_samples, 4),
    total_visits: num(r.total_visits, 0),
    total_with_crowd: num(r.total_with_crowd, 0),
    by_season_hour: arr<SeasonHourCell>(r.by_season_hour),
    by_season_daytype: arr<SeasonDayTypeCell>(r.by_season_daytype),
    by_community: arr<CommunityCell>(r.by_community),
    quietest: obj<Almanac["quietest"]>(r.quietest),
    warmest: obj<Almanac["warmest"]>(r.warmest),
  };
}
