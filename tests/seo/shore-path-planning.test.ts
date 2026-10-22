import { test } from "node:test";
import assert from "node:assert/strict";
import { SHORE_PATH_LEGS, SHORE_PATH_MAP_MILES } from "../../src/lib/shorePathPlanning";

test("the official map's seven approximate legs total 21 miles", () => {
  assert.equal(SHORE_PATH_LEGS.length, 7);
  assert.equal(SHORE_PATH_MAP_MILES, 21);
});

test("Williams Bay to Fontana is 3.5 miles one way, not a round trip", () => {
  const leg = SHORE_PATH_LEGS.find((item) => item.from === "Williams Bay" && item.to === "Fontana");
  assert.equal(leg?.miles, 3.5);
});

test("Big Foot Beach to Lake Geneva is 2 miles, or 4 miles out and back", () => {
  const leg = SHORE_PATH_LEGS.find((item) => item.from === "Big Foot Beach" && item.to === "Lake Geneva");
  assert.equal(leg?.miles, 2);
  assert.equal((leg?.miles ?? 0) * 2, 4);
});