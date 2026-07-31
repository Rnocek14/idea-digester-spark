// Shore Path Register — tier arithmetic and geofence verification.
//
// Pure functions with no Deno or Supabase imports, so the edge function and the
// node:test suite run the exact same code. Nothing here touches the network or
// the clock except where a date is passed in explicitly.

export type SeasonBucket = "spring" | "summer" | "fall" | "winter";
export type Verification = "verified" | "imported" | "self_reported";

export const SEASONS: SeasonBucket[] = ["spring", "summer", "fall", "winter"];

/** A stop as the register needs it — a subset of shore_path_stops. */
export type RegisterStop = {
  id: string;
  slug: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
  leg_order_index: number | null;
  /** The shore this stop sits on. Drives the mid-progression ladder. */
  community: string | null;
};

export type StopVisit = {
  stop_id: string;
  visited_at: string;
  season: SeasonBucket;
  verification: Verification;
};

/** Default geofence when a stop has no explicit radius. Matches src/lib/shorePathGeo.ts. */
export const DEFAULT_GEOFENCE_M = 140;

/**
 * A device fix worse than this is not evidence of anything — a ±500m reading
 * "inside" a 140m geofence is just noise. Such a visit is still recorded, but as
 * self_reported rather than verified.
 */
export const MAX_TRUSTED_ACCURACY_M = 250;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Haversine distance in meters. Mirrors src/lib/shorePathGeo.ts. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type ProximityCheck = {
  /** Inside the stop's geofence. */
  within: boolean;
  distanceM: number;
  /** Provenance the server is willing to assert for this fix. */
  verification: Verification;
  reason?: string;
};

/**
 * Decide, server-side, whether a claimed position actually puts the walker at a
 * stop. The client is never trusted to assert its own arrival: it sends
 * coordinates, and this decides what they prove.
 */
export function checkStopProximity(
  stop: RegisterStop,
  lat: number | null | undefined,
  lng: number | null | undefined,
  accuracyM: number | null | undefined,
): ProximityCheck {
  if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) {
    return { within: false, distanceM: NaN, verification: "self_reported", reason: "no_coordinates" };
  }
  if (stop.latitude == null || stop.longitude == null) {
    return { within: false, distanceM: NaN, verification: "self_reported", reason: "stop_has_no_coordinates" };
  }

  const distanceM = distanceMeters(lat, lng, stop.latitude, stop.longitude);
  const radius = stop.geofence_radius_m ?? DEFAULT_GEOFENCE_M;

  // Allow the device's own error estimate to widen the fence, but only up to the
  // point where the fix stops meaning anything.
  const slack = Math.min(accuracyM ?? 0, MAX_TRUSTED_ACCURACY_M);
  const within = distanceM <= radius + slack;

  if (!within) {
    return { within: false, distanceM, verification: "self_reported", reason: "outside_geofence" };
  }
  if (accuracyM != null && accuracyM > MAX_TRUSTED_ACCURACY_M) {
    return { within: true, distanceM, verification: "self_reported", reason: "accuracy_too_poor" };
  }
  return { within: true, distanceM, verification: "verified" };
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

/**
 * Meteorological seasons, which is how the guide page already talks about the
 * walking year (late spring / summer / October / winter).
 *
 * `month` is 1-12 in the city's local timezone, not UTC — a 7pm November walk in
 * Wisconsin is already the next UTC day, and getting that wrong would file walks
 * under the wrong season at the boundaries.
 */
export function seasonForMonth(month: number): SeasonBucket {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export type LocalDateParts = { year: number; month: number; day: number; isoDate: string };

/** Calendar parts of an instant in a named timezone. */
export function localDateParts(when: Date, timeZone: string): LocalDateParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(when);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const pad = (n: number) => String(n).padStart(2, "0");
  return { year, month, day, isoDate: `${year}-${pad(month)}-${pad(day)}` };
}

// ---------------------------------------------------------------------------
// Progress and tiers
// ---------------------------------------------------------------------------

export type LegProgress = {
  orderIndex: number;
  stopsTotal: number;
  stopsVisited: number;
  complete: boolean;
};

/**
 * Progress along one shore of the lake.
 *
 * This is the rung between "first stop" and "all sixteen". Leg badges were meant
 * to be that rung and can't be yet — see the shore-progress migration for why a
 * single leg index can't honestly describe a stop that sits on two legs at once.
 * Shores are grouped from `community`, which is already in the data and needs no
 * map to be correct.
 */
export type ShoreProgress = {
  community: string;
  stopsTotal: number;
  stopsVisited: number;
  complete: boolean;
};

export type WalkerProgress = {
  stopsVisited: number;
  stopsTotal: number;
  visitedStopIds: string[];
  /** Weakest provenance across the visits that make up the loop. */
  verification: Verification;
  loopComplete: boolean;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  /** Days from first stop to last, inclusive of both ends. */
  daysElapsed: number | null;
  /** Seasons in which every stop has been visited (aggregated across years). */
  seasonsCompleted: SeasonBucket[];
  /** Per-season stop counts, for showing how far off each season is. */
  seasonStopCounts: Record<SeasonBucket, number>;
  fourSeasonsComplete: boolean;
  legs: LegProgress[];
  legsCompleted: number;
  /** Per-shore progress, in walking order of first appearance. */
  shores: ShoreProgress[];
  shoresCompleted: number;
};

const VERIFICATION_RANK: Record<Verification, number> = {
  verified: 2,
  imported: 1,
  self_reported: 0,
};

/** The weakest provenance in a set — a loop is only as verified as its softest stop. */
export function weakestVerification(values: Verification[]): Verification {
  if (values.length === 0) return "self_reported";
  return values.reduce((worst, v) =>
    VERIFICATION_RANK[v] < VERIFICATION_RANK[worst] ? v : worst,
  );
}

function dayDiffInclusive(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Roll a walker's visits up into badge and register state.
 *
 * Loop = every published stop visited at least once, on any dates in any order.
 * Nobody walks 21 miles in one push and the page says so, so requiring a single
 * outing would mean the tier is never earned.
 *
 * Four seasons = the loop completed within each of the four season buckets.
 * Season buckets aggregate across years on purpose: a stop walked in January
 * 2027 and another in February 2028 both count toward the same winter, which is
 * the only reading that makes a multi-year tier achievable.
 */
export function computeProgress(
  stops: RegisterStop[],
  visits: StopVisit[],
  legs: Array<{ order_index: number }> = [],
): WalkerProgress {
  const stopIds = new Set(stops.map((s) => s.id));
  // Ignore visits to stops that have since been unpublished or deleted.
  const relevant = visits.filter((v) => stopIds.has(v.stop_id));

  const visitedStopIds = [...new Set(relevant.map((v) => v.stop_id))];
  const stopsTotal = stops.length;
  const stopsVisited = visitedStopIds.length;
  const loopComplete = stopsTotal > 0 && stopsVisited >= stopsTotal;

  const times = relevant
    .map((v) => new Date(v.visited_at))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const firstVisit = times[0] ?? null;
  const lastVisit = times[times.length - 1] ?? null;

  // Per-season distinct stop counts.
  const bySeason: Record<SeasonBucket, Set<string>> = {
    spring: new Set(),
    summer: new Set(),
    fall: new Set(),
    winter: new Set(),
  };
  for (const v of relevant) {
    if (v.season in bySeason) bySeason[v.season].add(v.stop_id);
  }
  const seasonStopCounts = SEASONS.reduce((acc, s) => {
    acc[s] = bySeason[s].size;
    return acc;
  }, {} as Record<SeasonBucket, number>);
  const seasonsCompleted = stopsTotal > 0
    ? SEASONS.filter((s) => bySeason[s].size >= stopsTotal)
    : [];

  // Leg progress. Legs with no stops assigned are reported but never complete —
  // see the leg_order_index comment in the register migration.
  const legProgress: LegProgress[] = legs
    .map((leg) => {
      const legStops = stops.filter((s) => s.leg_order_index === leg.order_index);
      const visited = legStops.filter((s) => visitedStopIds.includes(s.id)).length;
      return {
        orderIndex: leg.order_index,
        stopsTotal: legStops.length,
        stopsVisited: visited,
        complete: legStops.length > 0 && visited >= legStops.length,
      };
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Shores, in the order they first appear in walking order — so the ladder
  // reads the way the walk does rather than alphabetically. A stop with no
  // community is left out of the ladder entirely rather than grouped under a
  // blank heading; the migration raises if any published stop is missing one.
  const shoreOrder: string[] = [];
  const shoreStops = new Map<string, RegisterStop[]>();
  for (const s of stops) {
    const key = (s.community ?? "").trim();
    if (!key) continue;
    if (!shoreStops.has(key)) {
      shoreStops.set(key, []);
      shoreOrder.push(key);
    }
    shoreStops.get(key)!.push(s);
  }
  const visitedSet = new Set(visitedStopIds);
  const shores: ShoreProgress[] = shoreOrder.map((community) => {
    const group = shoreStops.get(community)!;
    const visited = group.filter((s) => visitedSet.has(s.id)).length;
    return {
      community,
      stopsTotal: group.length,
      stopsVisited: visited,
      complete: group.length > 0 && visited >= group.length,
    };
  });

  return {
    stopsVisited,
    stopsTotal,
    visitedStopIds,
    verification: weakestVerification(relevant.map((v) => v.verification)),
    loopComplete,
    firstVisitAt: firstVisit ? firstVisit.toISOString() : null,
    lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
    daysElapsed: firstVisit && lastVisit ? dayDiffInclusive(firstVisit, lastVisit) : null,
    seasonsCompleted,
    seasonStopCounts,
    fourSeasonsComplete: seasonsCompleted.length === SEASONS.length,
    legs: legProgress,
    legsCompleted: legProgress.filter((l) => l.complete).length,
    shores,
    shoresCompleted: shores.filter((s) => s.complete).length,
  };
}

/** Which numbered register tiers this progress has earned. */
export function earnedRegisterTiers(p: WalkerProgress): Array<"loop" | "four_seasons"> {
  const tiers: Array<"loop" | "four_seasons"> = [];
  if (p.loopComplete) tiers.push("loop");
  if (p.fourSeasonsComplete) tiers.push("four_seasons");
  return tiers;
}
