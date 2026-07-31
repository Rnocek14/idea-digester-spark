import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crowdShade,
  crowdWord,
  CROWD_WORDS,
  HOUR_BUCKETS,
  HOUR_LABELS,
  SEASON_BUCKETS,
  SEASON_LABELS,
  normalizeAlmanac,
} from "../../src/lib/pathAlmanacFormat.ts";

test("the ends of the 0-2 crowd scale map to the ends of the word list", () => {
  assert.equal(crowdWord(0), "Empty");
  assert.equal(crowdWord(2), "Busy");
  assert.equal(crowdWord(1), "Some", "the midpoint should be the middle word");
});

test("crowdWord covers every word without skipping one", () => {
  const seen = new Set<string>();
  for (let m = 0; m <= 2.0001; m += 0.05) seen.add(crowdWord(m));
  assert.deepEqual(
    [...CROWD_WORDS].sort(),
    [...seen].sort(),
    "every label should be reachable — a skipped one is an off-by-one",
  );
});

test("crowdWord is monotonic: busier input never reads as quieter", () => {
  let lastIndex = -1;
  for (let m = 0; m <= 2.0001; m += 0.01) {
    const i = (CROWD_WORDS as readonly string[]).indexOf(crowdWord(m));
    assert.ok(i >= lastIndex, `crowdWord(${m.toFixed(2)}) went backwards`);
    lastIndex = i;
  }
});

test("real SQL outputs land on sensible words", () => {
  // Values taken from the local Postgres run: summer weekday mornings vs
  // summer weekend afternoons.
  assert.equal(crowdWord(0.55), "Quiet");
  assert.equal(crowdWord(2.0), "Busy");
});

test("a missing mean renders as an em dash rather than Empty", () => {
  // "Empty" for no data would be an outright false claim about the path.
  assert.equal(crowdWord(null), "—");
  assert.equal(crowdWord(undefined), "—");
  assert.equal(crowdWord(NaN), "—");
});

test("out-of-range means are clamped instead of indexing off the end", () => {
  assert.equal(crowdWord(-5), "Empty");
  assert.equal(crowdWord(99), "Busy");
  assert.equal(crowdWord(Infinity), "—");
});

test("crowdShade returns a distinct class per band and a neutral one for no data", () => {
  const bands = [0, 0.5, 1.0, 1.8].map(crowdShade);
  assert.equal(new Set(bands).size, 4, "each band should be visually distinct");
  assert.match(crowdShade(null), /stone-50/);
  assert.match(crowdShade(NaN), /stone-50/);
});

test("every bucket has a label, so no header can render blank", () => {
  for (const h of HOUR_BUCKETS) {
    assert.ok(HOUR_LABELS[h]?.length > 0, `missing label for hour bucket ${h}`);
  }
  for (const s of SEASON_BUCKETS) {
    assert.ok(SEASON_LABELS[s]?.length > 0, `missing label for season ${s}`);
  }
});

test("the hour buckets match the boundaries the SQL function splits on", () => {
  // get_shore_path_almanac cuts at <8, <11, <14, <17, else. The labels have to
  // agree with that or the grid lies about what it is showing.
  assert.deepEqual(HOUR_BUCKETS, ["dawn", "morning", "midday", "afternoon", "evening"]);
  assert.match(HOUR_LABELS.dawn, /8/);
  assert.match(HOUR_LABELS.morning, /8/);
  assert.match(HOUR_LABELS.morning, /11/);
  assert.match(HOUR_LABELS.midday, /11/);
  assert.match(HOUR_LABELS.afternoon, /5/);
  assert.match(HOUR_LABELS.evening, /5/);
});

// ---------------------------------------------------------------------------
// normalizeAlmanac — the guard on a real crash
// ---------------------------------------------------------------------------
// PathAlmanac iterated `data.by_season_hour` after only checking `data` was
// truthy. A response that was truthy but shaped differently threw
// "by_season_hour is not iterable" and white-screened the entire Shore Path
// guide — the site's best page — because of a panel near the bottom of it.
// Found by rendering the page in a browser; no unit test would have caught it.

test("a well-formed payload passes through intact", () => {
  const raw = {
    min_samples: 4, total_visits: 43, total_with_crowd: 43,
    by_season_hour: [{ season: "summer", hour_bucket: "morning", samples: 22, crowd_mean: 0.55, temp_median: 70 }],
    by_season_daytype: [{ season: "summer", day_type: "weekday", samples: 22, crowd_mean: 0.55 }],
    by_community: [{ community: "Fontana", samples: 21, crowd_mean: 2, temp_median: 89 }],
    quietest: { season: "summer", hour_bucket: "morning", day_type: "weekday", samples: 22, crowd_mean: 0.55 },
    warmest: { season: "summer", hour_bucket: "afternoon", samples: 21, temp_median: 89 },
  };
  const n = normalizeAlmanac(raw)!;
  assert.equal(n.total_visits, 43);
  assert.equal(n.by_season_hour.length, 1);
  assert.equal(n.quietest?.crowd_mean, 0.55);
  assert.equal(n.warmest?.temp_median, 89);
});

test("the exact payload that crashed the page now degrades safely", () => {
  // An empty array is truthy and has no by_season_hour.
  assert.equal(normalizeAlmanac([]), null);
});

test("nothing that isn't an object becomes an almanac", () => {
  for (const v of [null, undefined, 0, "", "nope", true, [], [1, 2]]) {
    assert.equal(normalizeAlmanac(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test("missing collections become empty arrays, never undefined", () => {
  const n = normalizeAlmanac({ min_samples: 4 })!;
  assert.ok(n, "an object payload should still produce an almanac");
  for (const key of ["by_season_hour", "by_season_daytype", "by_community"] as const) {
    assert.ok(Array.isArray(n[key]), `${key} must be iterable`);
    assert.equal(n[key].length, 0);
  }
  assert.equal(n.quietest, null);
  assert.equal(n.warmest, null);
});

test("collections sent as the wrong type are replaced, not passed through", () => {
  const n = normalizeAlmanac({
    by_season_hour: "not an array",
    by_season_daytype: { nope: true },
    by_community: 42,
    quietest: [],
    warmest: "warm",
  })!;
  assert.deepEqual(n.by_season_hour, []);
  assert.deepEqual(n.by_season_daytype, []);
  assert.deepEqual(n.by_community, []);
  assert.equal(n.quietest, null, "an array must not be accepted as the quietest object");
  assert.equal(n.warmest, null);
});

test("a junk min_samples falls back to the documented floor", () => {
  assert.equal(normalizeAlmanac({ min_samples: "four" })!.min_samples, 4);
  assert.equal(normalizeAlmanac({ min_samples: NaN })!.min_samples, 4);
  assert.equal(normalizeAlmanac({ min_samples: 7 })!.min_samples, 7);
});

test("counts default to zero rather than NaN in the copy", () => {
  const n = normalizeAlmanac({})!;
  assert.equal(n.total_visits, 0);
  assert.equal(n.total_with_crowd, 0);
});
