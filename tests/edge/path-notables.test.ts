import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMinutes } from "../../src/lib/pathAlmanacFormat.ts";
import { normalizeNotables } from "../../src/lib/pathNotables.ts";

// ---------------------------------------------------------------------------
// formatMinutes
// ---------------------------------------------------------------------------

test("minutes read the way a walker would say them", () => {
  assert.equal(formatMinutes(0), "0 min");
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(59), "59 min");
  assert.equal(formatMinutes(60), "1h", "a round hour should not read '1h 0m'");
  assert.equal(formatMinutes(90), "1h 30m");
  assert.equal(formatMinutes(214), "3h 34m");
  assert.equal(formatMinutes(600), "10h", "a full loop day");
});

test("formatMinutes rounds rather than truncating", () => {
  assert.equal(formatMinutes(44.6), "45 min");
  assert.equal(formatMinutes(59.7), "1h");
});

test("formatMinutes refuses junk instead of printing NaN", () => {
  for (const v of [null, undefined, NaN, Infinity, -5]) {
    assert.equal(formatMinutes(v as number), "—", `expected an em dash for ${String(v)}`);
  }
});

// ---------------------------------------------------------------------------
// normalizeNotables — same guard the almanac needed
// ---------------------------------------------------------------------------

test("a well-formed payload passes through", () => {
  const n = normalizeNotables({
    total_walks: 12, min_stops: 2, season: "summer", community: null,
    hottest: { display_name: "Riley N.", home_town: "Williams Bay", on_date: "2026-07-14", season: "summer", stops: 5, temp_f: 94 },
    coldest: null, busiest: null, emptiest: null, largest_group: null,
    most_stops: null, longest_outing: null, earliest_start: null, latest_finish: null,
    linger: [{ stop_slug: "riviera-beach", stop_name: "The Riviera", community: "Lake Geneva", median_minutes: 38, samples: 9 }],
    seasons_available: ["summer", "fall"],
  })!;
  assert.equal(n.total_walks, 12);
  assert.equal(n.season, "summer");
  assert.equal(n.hottest?.temp_f, 94);
  assert.equal(n.linger.length, 1);
  assert.deepEqual(n.seasons_available, ["summer", "fall"]);
});

test("junk payloads never reach the component", () => {
  for (const v of [null, undefined, "nope", 7, true, [], [1]]) {
    assert.equal(normalizeNotables(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test("an empty board is valid, not a crash", () => {
  const n = normalizeNotables({})!;
  assert.equal(n.total_walks, 0);
  assert.equal(n.min_stops, 2, "the floor should default, not become NaN");
  assert.deepEqual(n.linger, []);
  assert.deepEqual(n.seasons_available, []);
  for (const k of ["hottest", "coldest", "busiest", "emptiest", "largest_group",
                   "most_stops", "longest_outing", "earliest_start", "latest_finish"] as const) {
    assert.equal(n[k], null, `${k} should be null, not undefined`);
  }
});

test("a superlative sent as an array is rejected rather than rendered", () => {
  // to_jsonb of an empty row set can surface oddly; an array here would break
  // property access in the card.
  const n = normalizeNotables({ hottest: [], linger: "not an array" })!;
  assert.equal(n.hottest, null);
  assert.deepEqual(n.linger, []);
});

test("an anonymous walk is representable — a null name is normal, not missing data", () => {
  // Walkers who did not join the public register appear with no name at all.
  const n = normalizeNotables({
    hottest: { display_name: null, home_town: null, on_date: "2026-07-14", season: "summer", stops: 4, temp_f: 91 },
  })!;
  assert.equal(n.hottest?.display_name, null);
  assert.equal(n.hottest?.temp_f, 91);
});
