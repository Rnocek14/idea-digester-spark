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
