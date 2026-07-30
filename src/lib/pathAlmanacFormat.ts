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
