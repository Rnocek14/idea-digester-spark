import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haversineKm,
  nearestCity,
  parseZippopotam,
  isValidUsZip,
  kmToMiles,
  type CityPoint,
} from "../../src/lib/cityDistance.ts";

const LG: CityPoint = {
  id: "default",
  city_name: "Lake Geneva",
  state_code: "WI",
  site_domain: "lakegenevabrief.com",
  status: "active",
  latitude: 42.5917,
  longitude: -88.4334,
};
const MADISON: CityPoint = {
  id: "madison-wi",
  city_name: "Madison",
  state_code: "WI",
  site_domain: "madisonbrief.com",
  status: "active",
  latitude: 43.0731,
  longitude: -89.4012,
};

test("haversine sanity: Lake Geneva to Madison is ~95km", () => {
  const d = haversineKm(LG.latitude, LG.longitude, MADISON.latitude, MADISON.longitude);
  assert.ok(d > 85 && d < 105, `expected ~95km, got ${d.toFixed(1)}`);
});

test("haversine zero distance", () => {
  assert.equal(haversineKm(42.5, -88.4, 42.5, -88.4), 0);
});

test("nearestCity picks the closest city within the radius", () => {
  // Delavan, WI (~42.633, -88.644): ~18km from Lake Geneva, ~75km from Madison
  const match = nearestCity([MADISON, LG], 42.633, -88.644);
  assert.ok(match);
  assert.equal(match!.city.id, "default");
  assert.ok(match!.distanceKm < 25);
});

test("nearestCity returns null beyond the radius (waitlist territory)", () => {
  // Green Bay (~44.51, -88.01): far from both cities
  assert.equal(nearestCity([LG, MADISON], 44.51, -88.01), null);
});

test("nearestCity radius boundary is inclusive-ish", () => {
  const justInside = nearestCity([LG], 42.5917, -88.4334, 1);
  assert.ok(justInside);
  const outside = nearestCity([LG], 43.5, -88.4334, 1);
  assert.equal(outside, null);
});

test("nearestCity ignores cities with missing coordinates", () => {
  const broken = { ...LG, latitude: undefined as unknown as number };
  assert.equal(nearestCity([broken], 42.59, -88.43), null);
});

test("parseZippopotam extracts lat/lon/label from the real response shape", () => {
  const sample = {
    "post code": "53147",
    country: "United States",
    places: [
      {
        "place name": "Lake Geneva",
        "state abbreviation": "WI",
        latitude: "42.5917",
        longitude: "-88.4334",
      },
    ],
  };
  const parsed = parseZippopotam(sample);
  assert.ok(parsed);
  assert.equal(parsed!.label, "Lake Geneva, WI");
  assert.ok(Math.abs(parsed!.lat - 42.5917) < 1e-9);
});

test("parseZippopotam rejects malformed payloads", () => {
  assert.equal(parseZippopotam({}), null);
  assert.equal(parseZippopotam({ places: [] }), null);
  assert.equal(parseZippopotam({ places: [{ latitude: "not-a-number", longitude: "x" }] }), null);
  assert.equal(parseZippopotam(null), null);
});

test("isValidUsZip", () => {
  assert.equal(isValidUsZip("53147"), true);
  assert.equal(isValidUsZip(" 53147 "), true);
  assert.equal(isValidUsZip("5314"), false);
  assert.equal(isValidUsZip("53147-1234"), false);
  assert.equal(isValidUsZip("abcde"), false);
});

test("kmToMiles", () => {
  assert.ok(Math.abs(kmToMiles(10) - 6.21371) < 1e-4);
});
