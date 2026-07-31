import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkStopProximity,
  computeProgress,
  distanceMeters,
  earnedRegisterTiers,
  localDateParts,
  seasonForMonth,
  weakestVerification,
  DEFAULT_GEOFENCE_M,
  MAX_TRUSTED_ACCURACY_M,
  type RegisterStop,
  type SeasonBucket,
  type StopVisit,
} from "../../supabase/functions/_shared/pathTiers.ts";

// Real coordinates from the seeded shore_path_stops rows.
const LIBRARY_PARK: RegisterStop = {
  id: "stop-1",
  slug: "library-park",
  name: "Library Park",
  latitude: 42.5915,
  longitude: -88.4334,
  geofence_radius_m: null,
  leg_order_index: null,
  community: 'Lake Geneva',
};
const FONTANA_BEACH: RegisterStop = {
  id: "stop-9",
  slug: "fontana-beach",
  name: "Fontana Beach",
  latitude: 42.547,
  longitude: -88.571,
  geofence_radius_m: null,
  leg_order_index: null,
  community: 'Lake Geneva',
};

function stops(n: number): RegisterStop[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `stop-${i + 1}`,
    slug: `stop-${i + 1}`,
    name: `Stop ${i + 1}`,
    latitude: 42.59 + i * 0.001,
    longitude: -88.43 - i * 0.001,
    geofence_radius_m: null,
    leg_order_index: null,
    // Alternating shores so the grouping has something to group.
    community: i % 2 === 0 ? 'Lake Geneva' : 'Williams Bay',
  }));
}

function visit(
  stopId: string,
  season: SeasonBucket,
  isoDate: string,
  verification: StopVisit["verification"] = "verified",
): StopVisit {
  return { stop_id: stopId, season, visited_at: isoDate, verification };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

test("distanceMeters matches the known Library Park -> Fontana Beach separation", () => {
  const d = distanceMeters(
    LIBRARY_PARK.latitude!,
    LIBRARY_PARK.longitude!,
    FONTANA_BEACH.latitude!,
    FONTANA_BEACH.longitude!,
  );
  // Straight across the lake, roughly 12.3 km — not the 13 walking miles.
  assert.ok(d > 12_000 && d < 12_800, `expected ~12.3km, got ${Math.round(d)}m`);
});

test("distanceMeters is zero for identical points", () => {
  assert.equal(distanceMeters(42.5915, -88.4334, 42.5915, -88.4334), 0);
});

test("standing at a stop verifies", () => {
  const r = checkStopProximity(LIBRARY_PARK, 42.5915, -88.4334, 12);
  assert.equal(r.within, true);
  assert.equal(r.verification, "verified");
  assert.ok(r.distanceM < 1);
});

test("a fix just inside the default geofence verifies", () => {
  // ~100m north of Library Park; 1 degree of latitude is ~111km.
  const lat = LIBRARY_PARK.latitude! + 100 / 111_000;
  const r = checkStopProximity(LIBRARY_PARK, lat, LIBRARY_PARK.longitude!, 10);
  assert.equal(r.within, true);
  assert.equal(r.verification, "verified");
  assert.ok(r.distanceM < DEFAULT_GEOFENCE_M);
});

test("a fix well outside the geofence is rejected", () => {
  const r = checkStopProximity(LIBRARY_PARK, FONTANA_BEACH.latitude!, FONTANA_BEACH.longitude!, 10);
  assert.equal(r.within, false);
  assert.equal(r.reason, "outside_geofence");
});

test("a per-stop geofence radius overrides the default", () => {
  const tight = { ...LIBRARY_PARK, geofence_radius_m: 30 };
  const lat = LIBRARY_PARK.latitude! + 100 / 111_000;
  assert.equal(checkStopProximity(tight, lat, LIBRARY_PARK.longitude!, 5).within, false);
  assert.equal(checkStopProximity(LIBRARY_PARK, lat, LIBRARY_PARK.longitude!, 5).within, true);
});

test("device accuracy widens the fence but caps out", () => {
  // 300m out: reachable only by letting a huge accuracy figure widen the fence.
  const lat = LIBRARY_PARK.latitude! + 300 / 111_000;
  const generous = checkStopProximity(LIBRARY_PARK, lat, LIBRARY_PARK.longitude!, 5000);
  // Slack is capped at MAX_TRUSTED_ACCURACY_M, so 140 + 250 = 390m still contains it...
  assert.equal(generous.within, true);
  // ...but a fix that vague cannot be called verified.
  assert.equal(generous.verification, "self_reported");
  assert.equal(generous.reason, "accuracy_too_poor");

  const farther = LIBRARY_PARK.latitude! + 600 / 111_000;
  assert.equal(
    checkStopProximity(LIBRARY_PARK, farther, LIBRARY_PARK.longitude!, 5000).within,
    false,
    `slack must not exceed ${MAX_TRUSTED_ACCURACY_M}m`,
  );
});

test("a claim with no coordinates is never verified", () => {
  const r = checkStopProximity(LIBRARY_PARK, null, null, null);
  assert.equal(r.within, false);
  assert.equal(r.verification, "self_reported");
  assert.equal(r.reason, "no_coordinates");
});

test("a stop with no coordinates cannot verify anyone", () => {
  const noCoords = { ...LIBRARY_PARK, latitude: null, longitude: null };
  const r = checkStopProximity(noCoords, 42.5915, -88.4334, 5);
  assert.equal(r.within, false);
  assert.equal(r.reason, "stop_has_no_coordinates");
});

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

test("seasonForMonth buckets all twelve months", () => {
  const expected: SeasonBucket[] = [
    "winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "fall", "fall", "fall", "winter",
  ];
  for (let m = 1; m <= 12; m++) {
    assert.equal(seasonForMonth(m), expected[m - 1], `month ${m}`);
  }
});

test("localDateParts uses the city timezone, not UTC", () => {
  // 02:30 UTC on Dec 1 is still 20:30 on Nov 30 in Chicago. Filed under UTC this
  // walk would count as winter; locally it is correctly fall.
  const instant = new Date("2026-12-01T02:30:00Z");
  const parts = localDateParts(instant, "America/Chicago");
  assert.equal(parts.isoDate, "2026-11-30");
  assert.equal(seasonForMonth(parts.month), "fall");
  assert.equal(seasonForMonth(localDateParts(instant, "UTC").month), "winter");
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

test("weakestVerification returns the softest link", () => {
  assert.equal(weakestVerification(["verified", "verified"]), "verified");
  assert.equal(weakestVerification(["verified", "imported"]), "imported");
  assert.equal(weakestVerification(["verified", "self_reported", "imported"]), "self_reported");
  assert.equal(weakestVerification([]), "self_reported");
});

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

test("a fresh walker has no progress and no tiers", () => {
  const p = computeProgress(stops(16), []);
  assert.equal(p.stopsVisited, 0);
  assert.equal(p.stopsTotal, 16);
  assert.equal(p.loopComplete, false);
  assert.equal(p.daysElapsed, null);
  assert.deepEqual(earnedRegisterTiers(p), []);
});

test("revisiting the same stop does not advance the loop", () => {
  const s = stops(16);
  const p = computeProgress(s, [
    visit("stop-1", "summer", "2026-07-01T15:00:00Z"),
    visit("stop-1", "summer", "2026-07-08T15:00:00Z"),
    visit("stop-1", "fall", "2026-10-08T15:00:00Z"),
  ]);
  assert.equal(p.stopsVisited, 1);
  assert.equal(p.loopComplete, false);
});

test("all stops across many days completes the loop", () => {
  const s = stops(16);
  const visits = s.map((stop, i) =>
    visit(stop.id, "summer", `2026-07-${String(i + 1).padStart(2, "0")}T15:00:00Z`),
  );
  const p = computeProgress(s, visits);
  assert.equal(p.loopComplete, true);
  assert.equal(p.stopsVisited, 16);
  assert.equal(p.daysElapsed, 16, "July 1 through July 16 inclusive");
  assert.equal(p.verification, "verified");
  assert.deepEqual(earnedRegisterTiers(p), ["loop"]);
});

test("one self-reported stop softens the whole loop", () => {
  const s = stops(3);
  const p = computeProgress(s, [
    visit("stop-1", "summer", "2026-07-01T15:00:00Z", "verified"),
    visit("stop-2", "summer", "2026-07-02T15:00:00Z", "self_reported"),
    visit("stop-3", "summer", "2026-07-03T15:00:00Z", "verified"),
  ]);
  assert.equal(p.loopComplete, true);
  assert.equal(p.verification, "self_reported");
});

test("visits to unpublished or deleted stops are ignored", () => {
  const s = stops(3);
  const p = computeProgress(s, [
    visit("stop-1", "summer", "2026-07-01T15:00:00Z"),
    visit("stop-2", "summer", "2026-07-02T15:00:00Z"),
    visit("stop-3", "summer", "2026-07-03T15:00:00Z"),
    visit("retired-stop", "summer", "2026-07-04T15:00:00Z"),
  ]);
  assert.equal(p.stopsVisited, 3);
  assert.equal(p.loopComplete, true, "a stale visit must not be needed for the loop");
});

test("four seasons needs the whole loop in each season, not one stop each", () => {
  const s = stops(4);
  // Every stop in summer, plus a token stop in each other season.
  const visits = [
    ...s.map((stop, i) => visit(stop.id, "summer", `2026-07-0${i + 1}T15:00:00Z`)),
    visit("stop-1", "fall", "2026-10-01T15:00:00Z"),
    visit("stop-1", "winter", "2027-01-05T15:00:00Z"),
    visit("stop-1", "spring", "2027-04-10T15:00:00Z"),
  ];
  const p = computeProgress(s, visits);
  assert.deepEqual(p.seasonsCompleted, ["summer"]);
  assert.equal(p.fourSeasonsComplete, false);
  assert.deepEqual(p.seasonStopCounts, { spring: 1, summer: 4, fall: 1, winter: 1 });
  assert.deepEqual(earnedRegisterTiers(p), ["loop"]);
});

test("season buckets aggregate across years so four seasons is achievable", () => {
  const s = stops(2);
  const seasons: SeasonBucket[] = ["spring", "summer", "fall", "winter"];
  const visits: StopVisit[] = [];
  for (const season of seasons) {
    // Deliberately split each season's two stops across different years.
    visits.push(visit("stop-1", season, `2026-01-01T15:00:00Z`));
    visits.push(visit("stop-2", season, `2028-01-01T15:00:00Z`));
  }
  const p = computeProgress(s, visits);
  assert.deepEqual(p.seasonsCompleted, ["spring", "summer", "fall", "winter"]);
  assert.equal(p.fourSeasonsComplete, true);
  assert.deepEqual(earnedRegisterTiers(p), ["loop", "four_seasons"]);
});

test("leg progress only completes legs that have stops assigned", () => {
  const s = stops(4);
  s[0].leg_order_index = 1;
  s[1].leg_order_index = 1;
  s[2].leg_order_index = 2;
  // s[3] intentionally unassigned, as the migration ships it.
  const legs = [{ order_index: 1 }, { order_index: 2 }, { order_index: 3 }];

  const p = computeProgress(s, [
    visit("stop-1", "summer", "2026-07-01T15:00:00Z"),
    visit("stop-2", "summer", "2026-07-01T15:00:00Z"),
  ], legs);

  assert.equal(p.legsCompleted, 1);
  assert.deepEqual(p.legs, [
    { orderIndex: 1, stopsTotal: 2, stopsVisited: 2, complete: true },
    { orderIndex: 2, stopsTotal: 1, stopsVisited: 0, complete: false },
    { orderIndex: 3, stopsTotal: 0, stopsVisited: 0, complete: false },
  ]);
});

test("an unassigned leg table awards no leg badges even on a finished loop", () => {
  const s = stops(3);
  const legs = [{ order_index: 1 }, { order_index: 2 }];
  const p = computeProgress(s, s.map((stop, i) =>
    visit(stop.id, "summer", `2026-07-0${i + 1}T15:00:00Z`),
  ), legs);
  assert.equal(p.loopComplete, true);
  assert.equal(p.legsCompleted, 0, "legs stay dormant until leg_order_index is filled in");
});

test("progress survives an empty stop table without dividing by zero", () => {
  const p = computeProgress([], [visit("stop-1", "summer", "2026-07-01T15:00:00Z")]);
  assert.equal(p.stopsTotal, 0);
  assert.equal(p.loopComplete, false);
  assert.equal(p.fourSeasonsComplete, false);
  assert.deepEqual(p.seasonsCompleted, []);
});

test("a same-day loop reports one day elapsed, not zero", () => {
  const s = stops(2);
  const p = computeProgress(s, [
    visit("stop-1", "fall", "2026-10-03T13:00:00Z"),
    visit("stop-2", "fall", "2026-10-03T18:00:00Z"),
  ]);
  assert.equal(p.daysElapsed, 1);
});

test("malformed timestamps do not poison the date range", () => {
  const s = stops(2);
  const p = computeProgress(s, [
    visit("stop-1", "fall", "not-a-date"),
    visit("stop-2", "fall", "2026-10-03T18:00:00Z"),
  ]);
  assert.equal(p.stopsVisited, 2);
  assert.equal(p.firstVisitAt, "2026-10-03T18:00:00.000Z");
  assert.equal(p.daysElapsed, 1);
});

// ---------------------------------------------------------------------------
// Shore progress — the rung between the first stop and all sixteen
// ---------------------------------------------------------------------------
// Leg badges cannot fill this gap yet: a single leg_order_index can't express
// that an access-point stop sits on two legs at once, so any assignment yields
// false positives or false negatives. Shores group from `community`, which is
// already correct in the data and needs no map.

function shoreStops(spec: Array<[string, number]>): RegisterStop[] {
  const out: RegisterStop[] = [];
  let n = 0;
  for (const [community, count] of spec) {
    for (let i = 0; i < count; i++) {
      n++;
      out.push({
        id: `stop-${n}`, slug: `stop-${n}`, name: `Stop ${n}`,
        latitude: 42.59, longitude: -88.43,
        geofence_radius_m: null, leg_order_index: null, community,
      });
    }
  }
  return out;
}

test("shores appear in walking order, not alphabetical order", () => {
  const s = shoreStops([["Lake Geneva", 5], ["Linn", 3], ["Fontana", 3], ["Williams Bay", 5]]);
  const p = computeProgress(s, []);
  assert.deepEqual(
    p.shores.map((x) => x.community),
    ["Lake Geneva", "Linn", "Fontana", "Williams Bay"],
    "the ladder should read the way the walk does",
  );
  assert.deepEqual(p.shores.map((x) => x.stopsTotal), [5, 3, 3, 5]);
});

test("finishing one shore completes it without completing the loop", () => {
  const s = shoreStops([["Lake Geneva", 5], ["Linn", 3], ["Fontana", 3], ["Williams Bay", 5]]);
  const visits = s.slice(0, 5).map((stop, i) =>
    visit(stop.id, "summer", `2026-07-0${i + 1}T15:00:00Z`),
  );
  const p = computeProgress(s, visits);

  assert.equal(p.loopComplete, false, "5 of 16 is not the loop");
  assert.equal(p.shoresCompleted, 1, "but one shore is genuinely finished");
  assert.equal(p.shores[0].complete, true);
  assert.equal(p.shores[0].stopsVisited, 5);
  assert.equal(p.shores[1].complete, false);
  assert.equal(p.shores[1].stopsVisited, 0);
});

test("partial progress on a shore is reported, not rounded away", () => {
  const s = shoreStops([["Lake Geneva", 5], ["Fontana", 3]]);
  const p = computeProgress(s, [
    visit("stop-1", "summer", "2026-07-01T15:00:00Z"),
    visit("stop-6", "summer", "2026-07-02T15:00:00Z"),
  ]);
  assert.equal(p.shores[0].stopsVisited, 1);
  assert.equal(p.shores[0].complete, false);
  assert.equal(p.shores[1].stopsVisited, 1);
  assert.equal(p.shoresCompleted, 0);
});

test("closing the loop completes every shore", () => {
  const s = shoreStops([["Lake Geneva", 5], ["Linn", 3], ["Fontana", 3], ["Williams Bay", 5]]);
  const p = computeProgress(s, s.map((stop, i) =>
    visit(stop.id, "summer", `2026-07-${String(i + 1).padStart(2, "0")}T15:00:00Z`),
  ));
  assert.equal(p.loopComplete, true);
  assert.equal(p.shoresCompleted, 4);
  assert.ok(p.shores.every((x) => x.complete));
});

test("a stop with no community is left out rather than grouped under a blank", () => {
  const s = shoreStops([["Lake Geneva", 2]]);
  s.push({
    id: "orphan", slug: "orphan", name: "Orphan", latitude: null, longitude: null,
    geofence_radius_m: null, leg_order_index: null, community: null,
  });
  s.push({
    id: "blank", slug: "blank", name: "Blank", latitude: null, longitude: null,
    geofence_radius_m: null, leg_order_index: null, community: "   ",
  });
  const p = computeProgress(s, []);
  assert.deepEqual(p.shores.map((x) => x.community), ["Lake Geneva"]);
  assert.ok(!p.shores.some((x) => x.community.trim() === ""), "no blank heading");
});

test("an unvisited shore never counts as complete", () => {
  const p = computeProgress(shoreStops([["Fontana", 3]]), []);
  assert.equal(p.shores[0].complete, false);
  assert.equal(p.shoresCompleted, 0);
});
