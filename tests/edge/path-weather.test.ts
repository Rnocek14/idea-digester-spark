import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_READING,
  hasAnyReading,
  hourKey,
  isCrowdLevel,
  isGroupSizeBand,
  localClockParts,
  openMeteoUrl,
  parseOpenMeteoCurrent,
  precipFromWmoCode,
} from "../../supabase/functions/_shared/pathWeather.ts";

// ---------------------------------------------------------------------------
// WMO codes
// ---------------------------------------------------------------------------

test("precipFromWmoCode collapses the WMO table to four useful words", () => {
  assert.equal(precipFromWmoCode(0), "clear");
  assert.equal(precipFromWmoCode(1), "clear");
  assert.equal(precipFromWmoCode(3), "cloud");
  assert.equal(precipFromWmoCode(45), "fog");
  assert.equal(precipFromWmoCode(61), "rain");
  assert.equal(precipFromWmoCode(81), "rain");
  assert.equal(precipFromWmoCode(73), "snow");
  assert.equal(precipFromWmoCode(86), "snow");
  assert.equal(precipFromWmoCode(95), "storm");
});

test("precipFromWmoCode returns null rather than guessing on junk", () => {
  assert.equal(precipFromWmoCode(null), null);
  assert.equal(precipFromWmoCode(undefined), null);
  assert.equal(precipFromWmoCode(NaN), null);
  assert.equal(precipFromWmoCode(999), null);
});

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

test("parseOpenMeteoCurrent reads a well-formed response", () => {
  const r = parseOpenMeteoCurrent({
    current: {
      temperature_2m: 71.4,
      apparent_temperature: 74.2,
      weather_code: 3,
      wind_speed_10m: 8.1,
    },
  });
  assert.deepEqual(r, { temp_f: 71.4, feels_like_f: 74.2, wind_mph: 8.1, precip: "cloud" });
});

test("parseOpenMeteoCurrent tolerates a below-zero reading", () => {
  // A February walk on the paved downtown stretch. Falsy-zero bugs live here.
  const r = parseOpenMeteoCurrent({
    current: { temperature_2m: 0, apparent_temperature: -11, weather_code: 71, wind_speed_10m: 0 },
  });
  assert.equal(r.temp_f, 0);
  assert.equal(r.feels_like_f, -11);
  assert.equal(r.wind_mph, 0);
  assert.equal(r.precip, "snow");
  assert.equal(hasAnyReading(r), true, "0°F is data, not a missing reading");
});

test("parseOpenMeteoCurrent degrades to nulls on garbage", () => {
  assert.deepEqual(parseOpenMeteoCurrent(null), EMPTY_READING);
  assert.deepEqual(parseOpenMeteoCurrent("nope"), EMPTY_READING);
  assert.deepEqual(parseOpenMeteoCurrent({}), EMPTY_READING);
  assert.deepEqual(parseOpenMeteoCurrent({ current: null }), EMPTY_READING);
  assert.deepEqual(parseOpenMeteoCurrent({ current: { temperature_2m: "warm" } }), EMPTY_READING);
});

test("hasAnyReading distinguishes empty from partial", () => {
  assert.equal(hasAnyReading(EMPTY_READING), false);
  assert.equal(hasAnyReading({ ...EMPTY_READING, precip: "clear" }), true);
  assert.equal(hasAnyReading({ ...EMPTY_READING, temp_f: 52 }), true);
});

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

test("openMeteoUrl asks for Fahrenheit and mph so nothing needs converting", () => {
  const url = openMeteoUrl(42.5915, -88.4334);
  assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(url, /latitude=42\.5915/);
  assert.match(url, /longitude=-88\.4334/);
  assert.match(url, /temperature_unit=fahrenheit/);
  assert.match(url, /wind_speed_unit=mph/);
  assert.match(url, /temperature_2m/);
  assert.match(url, /weather_code/);
});

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

test("hourKey truncates to the top of the UTC hour", () => {
  assert.equal(hourKey(new Date("2026-07-15T14:37:22.512Z")), "2026-07-15T14:00:00.000Z");
  assert.equal(hourKey(new Date("2026-07-15T14:00:00.000Z")), "2026-07-15T14:00:00.000Z");
});

test("every visit within one hour shares a cache key", () => {
  const a = hourKey(new Date("2026-07-15T14:01:00Z"));
  const b = hourKey(new Date("2026-07-15T14:59:59Z"));
  assert.equal(a, b, "sixteen stops in an hour must not be sixteen weather calls");
  assert.notEqual(a, hourKey(new Date("2026-07-15T15:00:00Z")));
});

test("hourKey does not mutate the date it is given", () => {
  const d = new Date("2026-07-15T14:37:22.512Z");
  hourKey(d);
  assert.equal(d.toISOString(), "2026-07-15T14:37:22.512Z");
});

// ---------------------------------------------------------------------------
// Local clock
// ---------------------------------------------------------------------------

test("localClockParts uses the city clock, not UTC", () => {
  // 01:30 UTC on July 16 is 20:30 on July 15 in Chicago — an evening walk, not a
  // small-hours one, and it belongs to the previous day of the week.
  const parts = localClockParts(new Date("2026-07-16T01:30:00Z"), "America/Chicago");
  assert.equal(parts.hour, 20);
  assert.equal(parts.month, 7);
  assert.equal(parts.dow, 3, "July 15 2026 is a Wednesday in local time");

  const utc = localClockParts(new Date("2026-07-16T01:30:00Z"), "UTC");
  assert.equal(utc.hour, 1);
  assert.equal(utc.dow, 4);
});

test("localClockParts normalises local midnight to hour 0", () => {
  // 05:00 UTC is midnight in Chicago during CDT. Some ICU builds render this as
  // hour "24", which would fail the hour_local BETWEEN 0 AND 23 constraint.
  const parts = localClockParts(new Date("2026-07-15T05:00:00Z"), "America/Chicago");
  assert.equal(parts.hour, 0);
  assert.ok(parts.hour >= 0 && parts.hour <= 23);
});

test("localClockParts handles both sides of a DST boundary", () => {
  // CST (UTC-6) in January, CDT (UTC-5) in July.
  assert.equal(localClockParts(new Date("2026-01-15T18:00:00Z"), "America/Chicago").hour, 12);
  assert.equal(localClockParts(new Date("2026-07-15T18:00:00Z"), "America/Chicago").hour, 13);
});

test("localClockParts covers a full week of day-of-week values", () => {
  // Sunday 2026-07-12 through Saturday 2026-07-18, at local midday.
  for (let i = 0; i < 7; i++) {
    const day = 12 + i;
    const parts = localClockParts(new Date(`2026-07-${day}T17:00:00Z`), "America/Chicago");
    assert.equal(parts.dow, i, `2026-07-${day} should be dow ${i}`);
  }
});

// ---------------------------------------------------------------------------
// Enum guards
// ---------------------------------------------------------------------------

test("crowd level and group band guards reject anything off-list", () => {
  for (const v of ["empty", "some", "busy"]) assert.equal(isCrowdLevel(v), true, v);
  for (const v of ["packed", "", "EMPTY", null, 3, {}]) {
    assert.equal(isCrowdLevel(v), false, JSON.stringify(v));
  }
  for (const v of ["solo", "pair", "small", "large"]) assert.equal(isGroupSizeBand(v), true, v);
  for (const v of ["huge", "1", null, 12]) {
    assert.equal(isGroupSizeBand(v), false, JSON.stringify(v));
  }
});
