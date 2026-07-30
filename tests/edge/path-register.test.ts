import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  makeRequest,
  callsFor,
  installFetchMock,
  jsonResponse as mockJson,
  TEST_ENV,
  importBundle,
  type Resolver,
  type QueryCall,
} from "./harness.ts";

const deno = installDeno({ ...TEST_ENV });

// Open-Meteo. Tests that care about the weather path override `weatherPayload`;
// everything else just gets a valid reading it can ignore.
let weatherPayload: unknown = {
  current: { temperature_2m: 68, apparent_temperature: 70, weather_code: 0, wind_speed_10m: 6 },
};
let weatherStatus = 200;
const weatherFetch = installFetchMock([
  {
    match: (url) => url.includes("api.open-meteo.com"),
    respond: () =>
      weatherStatus === 200
        ? mockJson(weatherPayload)
        : new Response("upstream down", { status: weatherStatus }),
  },
]);
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("path-register");
const handler = deno.handler();

// Real coordinates from the seeded shore_path_stops rows.
const STOPS = [
  { id: "s1", slug: "library-park", name: "Library Park", latitude: 42.5915, longitude: -88.4334, geofence_radius_m: null, leg_order_index: null },
  { id: "s2", slug: "flat-iron-park", name: "Flat Iron Park", latitude: 42.5921, longitude: -88.4361, geofence_radius_m: null, leg_order_index: null },
  { id: "s3", slug: "fontana-beach", name: "Fontana Beach", latitude: 42.547, longitude: -88.571, geofence_radius_m: null, leg_order_index: null },
];

const WALKER = {
  id: "w1",
  city_id: "default",
  display_name: "Riley N.",
  home_town: "Williams Bay",
  is_public: true,
};

type ResolverOverrides = {
  visits?: unknown[];
  entries?: unknown[];
  walker?: unknown;
  claimCounts?: { global?: number; ip?: number };
  visitsToday?: number;
  /** A cached weather row for the visit's hour, if the test wants a cache hit. */
  cachedWeather?: unknown;
  /** Rows returned by the `conditions` update. */
  conditionsUpdated?: unknown[];
  // deno-lint-ignore no-explicit-any
  rpc?: (args: any) => unknown;
};

/** Baseline resolver: three published stops, no legs, one known walker. */
function baseResolver(o: ResolverOverrides = {}): Resolver {
  return (q) => {
    if (q.table === "city_config") return { data: null };
    if (q.table === "shore_path_stops") return { data: STOPS };
    if (q.table === "path_legs") return { data: [] };
    if (q.table === "path_walkers" && q.op === "select") {
      return { data: "walker" in o ? o.walker : WALKER };
    }
    if (q.table === "path_walkers" && q.op === "insert") {
      return { data: { id: "w-new", display_name: null, home_town: null, is_public: false } };
    }
    if (q.table === "path_walkers" && q.op === "update") {
      const patch = (q.payload ?? {}) as Record<string, unknown>;
      return {
        data: {
          display_name: "display_name" in patch ? patch.display_name : WALKER.display_name,
          home_town: "home_town" in patch ? patch.home_town : WALKER.home_town,
          is_public: "is_public" in patch ? patch.is_public : WALKER.is_public,
        },
      };
    }
    if (q.table === "path_weather_hourly" && q.op === "select") {
      return { data: "cachedWeather" in o ? o.cachedWeather : null };
    }
    if (q.table === "path_weather_hourly") return { data: null };
    if (q.table === "path_stop_visits" && q.head) return { count: o.visitsToday ?? 0 };
    if (q.table === "path_stop_visits" && q.op === "update") {
      return { data: o.conditionsUpdated ?? [] };
    }
    if (q.table === "path_stop_visits" && q.op === "select") return { data: o.visits ?? [] };
    if (q.table === "path_stop_visits") return { data: null };
    if (q.table === "path_register_entries" && q.op === "select") return { data: o.entries ?? [] };
    if (q.table === "path_register_entries") return { data: null };
    if (q.table === "activity_log" && q.head) {
      const isIp = q.filters.some((f) => f.m === "eq" && f.args[0] === "details->>ip_hash");
      return { count: isIp ? (o.claimCounts?.ip ?? 0) : (o.claimCounts?.global ?? 0) };
    }
    if (q.table === "activity_log") return { data: null };
    if (q.table === "rpc:claim_path_register_entry") {
      // deno-lint-ignore no-explicit-any
      const args = q.payload as any;
      if (o.rpc) return { data: o.rpc(args) };
      return {
        data: {
          tier: args.p_tier,
          entry_number: args.p_tier === "loop" ? 218 : 3,
          display_name: args.p_display_name,
          home_town: args.p_home_town,
          completed_at: args.p_completed_at,
          days_elapsed: args.p_days_elapsed,
          verification: args.p_verification,
          certificate_code: "SP-L-00218-ab12",
        },
      };
    }
    return undefined;
  };
}

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = baseResolver();
  weatherFetch.requests.length = 0;
  weatherStatus = 200;
  weatherPayload = {
    current: { temperature_2m: 68, apparent_temperature: 70, weather_code: 0, wind_speed_10m: 6 },
  };
});

function post(body: unknown) {
  return handler(makeRequest("/", { body }));
}

/** All three stops visited in summer — a completed loop. */
function fullLoopVisits(season = "summer") {
  return STOPS.map((s, i) => ({
    stop_id: s.id,
    visited_at: `2026-07-0${i + 1}T15:00:00Z`,
    season,
    verification: "verified",
  }));
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

test("rejects non-POST", async () => {
  const res = await handler(makeRequest("/", { method: "GET" }));
  assert.equal(res.status, 405);
});

test("answers CORS preflight", async () => {
  const res = await handler(makeRequest("/", { method: "OPTIONS" }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});

test("rejects an unknown action", async () => {
  const res = await post({ action: "delete_everything", claim_token: "spw_abc" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Unknown action/);
});

// ---------------------------------------------------------------------------
// claim
// ---------------------------------------------------------------------------

test("claim mints an unguessable token and never echoes one supplied by the caller", async () => {
  const res = await post({ action: "claim", claim_token: "spw_attacker_chosen" });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.match(json.claim_token, /^spw_[0-9a-f]{32}$/);
  assert.notEqual(json.claim_token, "spw_attacker_chosen");
});

test("claim defaults a walker to private", async () => {
  await post({ action: "claim" });
  const insert = callsFor(sharedCalls, "path_walkers", "insert")[0];
  assert.equal((insert.payload as Record<string, unknown>).is_public, false);
});

test("claim sanitises name and town and drops a malformed email", async () => {
  await post({
    action: "claim",
    display_name: "   Riley    N.   ",
    home_town: "x".repeat(200),
    email: "not-an-email",
  });
  const payload = callsFor(sharedCalls, "path_walkers", "insert")[0].payload as Record<string, unknown>;
  assert.equal(payload.display_name, "Riley N.");
  assert.equal((payload.home_town as string).length, 60);
  assert.equal(payload.email, null);
});

test("claim keeps a valid email, lowercased", async () => {
  await post({ action: "claim", email: "  Walker@Example.COM " });
  const payload = callsFor(sharedCalls, "path_walkers", "insert")[0].payload as Record<string, unknown>;
  assert.equal(payload.email, "walker@example.com");
});

test("claim is rate limited per IP", async () => {
  currentResolver = baseResolver({ claimCounts: { ip: 5 } });
  const res = await post({ action: "claim" });
  assert.equal(res.status, 429);
  assert.equal(callsFor(sharedCalls, "path_walkers", "insert").length, 0);
});

test("claim is rate limited globally", async () => {
  currentResolver = baseResolver({ claimCounts: { global: 60 } });
  const res = await post({ action: "claim" });
  assert.equal(res.status, 429);
});

// ---------------------------------------------------------------------------
// Authentication by passport token
// ---------------------------------------------------------------------------

test("actions other than claim require a token", async () => {
  const res = await post({ action: "progress" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Missing passport token/);
});

test("an unknown token is rejected without confirming whether it exists", async () => {
  currentResolver = baseResolver({ walker: null });
  const res = await post({ action: "progress", claim_token: "spw_nope" });
  assert.equal(res.status, 404);
  const error = (await res.json()).error as string;
  assert.match(error, /Passport not found/);
  assert.doesNotMatch(error, /invalid token|no such/i);
});

// ---------------------------------------------------------------------------
// visit — server-side geofence verification
// ---------------------------------------------------------------------------

test("standing at a stop records a verified visit", async () => {
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "library-park",
    latitude: 42.5915,
    longitude: -88.4334,
    accuracy_m: 8,
  });
  assert.equal(res.status, 200);
  const upsert = callsFor(sharedCalls, "path_stop_visits", "upsert")[0];
  assert.ok(upsert, "expected the visit to be written");
  const payload = upsert.payload as Record<string, unknown>;
  assert.equal(payload.stop_id, "s1");
  assert.equal(payload.verification, "verified");
  assert.equal(payload.season, "summer");
  assert.equal(payload.distance_m, 0);
});

test("a client claiming a stop it is nowhere near is refused", async () => {
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "fontana-beach",
    latitude: 42.5915,
    longitude: -88.4334,
    accuracy_m: 8,
  });
  assert.equal(res.status, 422);
  const json = await res.json();
  assert.equal(json.reason, "outside_geofence");
  assert.ok(json.distance_m > 12_000);
  assert.equal(callsFor(sharedCalls, "path_stop_visits", "upsert").length, 0);
});

test("a visit claimed with no coordinates at all is refused", async () => {
  const res = await post({ action: "visit", claim_token: "spw_abc", stop_slug: "library-park" });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).reason, "no_coordinates");
  assert.equal(callsFor(sharedCalls, "path_stop_visits", "upsert").length, 0);
});

test("a very imprecise fix is recorded but not as verified", async () => {
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "library-park",
    latitude: 42.5915 + 300 / 111_000,
    longitude: -88.4334,
    accuracy_m: 4000,
  });
  assert.equal(res.status, 200);
  const payload = callsFor(sharedCalls, "path_stop_visits", "upsert")[0].payload as Record<string, unknown>;
  assert.equal(payload.verification, "self_reported");
});

test("an unknown stop slug is rejected", async () => {
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "my-back-garden",
    latitude: 42.5915,
    longitude: -88.4334,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Unknown stop/);
});

test("visits upsert on (walker, stop, day) so a parked geofence cannot double-count", async () => {
  await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "library-park",
    latitude: 42.5915,
    longitude: -88.4334,
    accuracy_m: 8,
  });
  const upsert = callsFor(sharedCalls, "path_stop_visits", "upsert")[0];
  assert.deepEqual(upsert.opts, { onConflict: "walker_id,stop_id,visit_date", ignoreDuplicates: true });
});

test("a walker hammering visits in one day is throttled", async () => {
  currentResolver = baseResolver({ visitsToday: 40 });
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "library-park",
    latitude: 42.5915,
    longitude: -88.4334,
  });
  assert.equal(res.status, 429);
  assert.equal(callsFor(sharedCalls, "path_stop_visits", "upsert").length, 0);
});

// ---------------------------------------------------------------------------
// progress and register numbering
// ---------------------------------------------------------------------------

test("partial progress issues no number", async () => {
  currentResolver = baseResolver({
    visits: [{ stop_id: "s1", visited_at: "2026-07-01T15:00:00Z", season: "summer", verification: "verified" }],
  });
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  const json = await res.json();
  assert.equal(json.progress.stops_visited, 1);
  assert.equal(json.progress.stops_total, 3);
  assert.equal(json.progress.loop_complete, false);
  assert.deepEqual(json.newly_earned, []);
  assert.equal(callsFor(sharedCalls, "rpc:claim_path_register_entry").length, 0);
});

test("a completed loop claims a number and reports it as newly earned", async () => {
  currentResolver = baseResolver({ visits: fullLoopVisits() });
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  const json = await res.json();

  assert.equal(json.progress.loop_complete, true);
  assert.equal(json.progress.days_elapsed, 3);
  assert.equal(json.newly_earned.length, 1);
  assert.equal(json.newly_earned[0].tier, "loop");
  assert.equal(json.newly_earned[0].entry_number, 218);

  const rpc = callsFor(sharedCalls, "rpc:claim_path_register_entry")[0];
  const args = rpc.payload as Record<string, unknown>;
  assert.equal(args.p_tier, "loop");
  assert.equal(args.p_walker_id, "w1");
  assert.equal(args.p_verification, "verified");
  assert.equal(args.p_is_public, true);
});

test("an already-numbered walker is not reported as newly earned again", async () => {
  currentResolver = baseResolver({
    visits: fullLoopVisits(),
    entries: [{
      tier: "loop",
      entry_number: 218,
      display_name: "Riley N.",
      home_town: "Williams Bay",
      completed_at: "2026-07-03T15:00:00Z",
      days_elapsed: 3,
      verification: "verified",
      certificate_code: "SP-L-00218-ab12",
    }],
  });
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  const json = await res.json();
  assert.deepEqual(json.newly_earned, [], "re-running progress must not re-announce the number");
  assert.equal(json.entries.length, 1);
  assert.equal(json.entries[0].entry_number, 218);
});

test("a loop softened by one self-reported stop is recorded as self_reported", async () => {
  const visits = fullLoopVisits();
  visits[1].verification = "self_reported";
  currentResolver = baseResolver({ visits });
  await post({ action: "progress", claim_token: "spw_abc" });
  const args = callsFor(sharedCalls, "rpc:claim_path_register_entry")[0].payload as Record<string, unknown>;
  assert.equal(args.p_verification, "self_reported");
});

test("the loop in all four seasons claims both numbers", async () => {
  const visits = ["spring", "summer", "fall", "winter"].flatMap((s) => fullLoopVisits(s));
  currentResolver = baseResolver({ visits });
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  const json = await res.json();

  assert.equal(json.progress.four_seasons_complete, true);
  assert.deepEqual(json.progress.seasons_completed, ["spring", "summer", "fall", "winter"]);
  const tiers = callsFor(sharedCalls, "rpc:claim_path_register_entry")
    .map((c) => (c.payload as Record<string, unknown>).p_tier);
  assert.deepEqual(tiers, ["loop", "four_seasons"]);
  assert.equal(json.newly_earned.length, 2);
});

test("a failed number claim does not break the response", async () => {
  currentResolver = (q) => {
    if (q.table === "rpc:claim_path_register_entry") return { error: { message: "deadlock" } };
    return baseResolver({ visits: fullLoopVisits() })(q);
  };
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.progress.loop_complete, true);
  assert.deepEqual(json.newly_earned, [], "no number issued, so nothing to announce");
});

test("progress never leaks another walker's identifiers", async () => {
  currentResolver = baseResolver({ visits: fullLoopVisits() });
  const res = await post({ action: "progress", claim_token: "spw_abc" });
  const body = await res.text();
  assert.doesNotMatch(body, /walker_id/, "walker_id must not appear in the response");
  assert.doesNotMatch(body, /spw_/, "the passport token must never be echoed back");
});

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

test("publishing yourself propagates to existing register entries", async () => {
  const res = await post({ action: "profile", claim_token: "spw_abc", is_public: true });
  assert.equal(res.status, 200);
  const sync = callsFor(sharedCalls, "path_register_entries", "update")[0];
  assert.ok(sync, "register entries should follow the walker's visibility");
  assert.equal((sync.payload as Record<string, unknown>).is_public, true);
  assert.ok(sync.filters.some((f) => f.m === "eq" && f.args[0] === "walker_id" && f.args[1] === "w1"));
});

test("retracting yourself unpublishes the register entry too", async () => {
  const res = await post({ action: "profile", claim_token: "spw_abc", is_public: false });
  assert.equal(res.status, 200);
  const sync = callsFor(sharedCalls, "path_register_entries", "update")[0];
  assert.equal((sync.payload as Record<string, unknown>).is_public, false);
});

test("an empty profile patch is rejected rather than clearing fields", async () => {
  const res = await post({ action: "profile", claim_token: "spw_abc" });
  assert.equal(res.status, 400);
  assert.equal(callsFor(sharedCalls, "path_walkers", "update").length, 0);
});

test("profile cannot be used to move a walker to another city or reset their token", async () => {
  await post({
    action: "profile",
    claim_token: "spw_abc",
    display_name: "Riley N.",
    city_id: "madison-wi",
    claim_token_new: "spw_hijack",
    id: "w2",
  });
  const patch = callsFor(sharedCalls, "path_walkers", "update")[0].payload as Record<string, unknown>;
  assert.deepEqual(Object.keys(patch), ["display_name"]);
});

// ---------------------------------------------------------------------------
// Conditions capture — the almanac's raw material
// ---------------------------------------------------------------------------

/** A visit at a real stop, with coordinates that will verify. */
function atLibraryPark(extra: Record<string, unknown> = {}) {
  return {
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "library-park",
    latitude: 42.5915,
    longitude: -88.4334,
    accuracy_m: 8,
    ...extra,
  };
}

function visitPayload() {
  return callsFor(sharedCalls, "path_stop_visits", "upsert")[0].payload as Record<string, unknown>;
}

test("a visit stamps the local clock so the almanac can bucket it", async () => {
  await post(atLibraryPark());
  const p = visitPayload();
  assert.equal(typeof p.hour_local, "number");
  assert.ok((p.hour_local as number) >= 0 && (p.hour_local as number) <= 23);
  assert.ok((p.dow_local as number) >= 0 && (p.dow_local as number) <= 6);
  assert.ok((p.month_local as number) >= 1 && (p.month_local as number) <= 12);
});

test("a visit fetches and stores conditions without the walker typing anything", async () => {
  await post(atLibraryPark());
  assert.equal(weatherFetch.requests.length, 1, "expected one Open-Meteo call");
  assert.match(weatherFetch.requests[0].url, /temperature_unit=fahrenheit/);

  const p = visitPayload();
  assert.equal(p.temp_f, 68);
  assert.equal(p.feels_like_f, 70);
  assert.equal(p.wind_mph, 6);
  assert.equal(p.precip, "clear");
});

test("a cached hour is reused instead of calling upstream again", async () => {
  currentResolver = baseResolver({
    cachedWeather: { temp_f: 41, feels_like_f: 35, wind_mph: 12, precip: "cloud" },
  });
  await post(atLibraryPark());
  assert.equal(weatherFetch.requests.length, 0, "a cache hit must not hit the network");
  const p = visitPayload();
  assert.equal(p.temp_f, 41);
  assert.equal(p.precip, "cloud");
});

test("a fresh reading is written to the cache for the rest of the hour", async () => {
  await post(atLibraryPark());
  const cacheWrite = callsFor(sharedCalls, "path_weather_hourly", "upsert")[0];
  assert.ok(cacheWrite, "expected the reading to be cached");
  const payload = cacheWrite.payload as Record<string, unknown>;
  assert.equal(payload.temp_f, 68);
  assert.match(String(payload.observed_hour), /T\d{2}:00:00\.000Z$/);
  assert.deepEqual(cacheWrite.opts, {
    onConflict: "city_id,observed_hour",
    ignoreDuplicates: true,
  });
});

test("a weather outage does not stop the stop being recorded", async () => {
  weatherStatus = 503;
  const res = await post(atLibraryPark());
  assert.equal(res.status, 200);
  const p = visitPayload();
  assert.equal(p.temp_f, null, "no reading, but the visit still lands");
  assert.equal(p.verification, "verified");
});

test("an empty weather reading is not cached as if it were data", async () => {
  weatherPayload = { current: {} };
  await post(atLibraryPark());
  assert.equal(callsFor(sharedCalls, "path_weather_hourly", "upsert").length, 0);
  assert.equal(visitPayload().temp_f, null);
});

test("a walk session id is recorded when supplied and rejected when malformed", async () => {
  const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  await post(atLibraryPark({ session_id: uuid }));
  assert.equal(visitPayload().session_id, uuid);

  sharedCalls.length = 0;
  await post(atLibraryPark({ session_id: "'; drop table path_walkers; --" }));
  assert.equal(visitPayload().session_id, null, "a non-uuid session must not be stored");
});

test("crowd answered at the first stop is stored, and junk is discarded", async () => {
  await post(atLibraryPark({ crowd_level: "empty", group_size_band: "pair" }));
  let p = visitPayload();
  assert.equal(p.crowd_level, "empty");
  assert.equal(p.group_size_band, "pair");

  sharedCalls.length = 0;
  await post(atLibraryPark({ crowd_level: "MOBBED", group_size_band: "47" }));
  p = visitPayload();
  assert.equal(p.crowd_level, null);
  assert.equal(p.group_size_band, null);
});

test("conditions applies one answer across the whole session", async () => {
  const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  currentResolver = baseResolver({ conditionsUpdated: [{ id: "v1" }, { id: "v2" }, { id: "v3" }] });
  const res = await post({
    action: "conditions",
    claim_token: "spw_abc",
    session_id: uuid,
    crowd_level: "busy",
    group_size_band: "small",
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).stops_updated, 3);

  const update = callsFor(sharedCalls, "path_stop_visits", "update")[0];
  assert.deepEqual(update.payload, { crowd_level: "busy", group_size_band: "small" });
});

test("conditions is scoped to the walker as well as the session", async () => {
  const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  await post({ action: "conditions", claim_token: "spw_abc", session_id: uuid, crowd_level: "some" });
  const update = callsFor(sharedCalls, "path_stop_visits", "update")[0];
  // A guessed session id must not be enough to rewrite someone else's walk.
  assert.ok(update.filters.some((f) => f.m === "eq" && f.args[0] === "walker_id" && f.args[1] === "w1"));
  assert.ok(update.filters.some((f) => f.m === "eq" && f.args[0] === "session_id" && f.args[1] === uuid));
});

test("conditions requires a session", async () => {
  const res = await post({ action: "conditions", claim_token: "spw_abc", crowd_level: "some" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Missing walk session/);
  assert.equal(callsFor(sharedCalls, "path_stop_visits", "update").length, 0);
});

test("conditions with nothing recordable is rejected rather than blanking rows", async () => {
  const res = await post({
    action: "conditions",
    claim_token: "spw_abc",
    session_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    crowd_level: "not-a-level",
  });
  assert.equal(res.status, 400);
  assert.equal(callsFor(sharedCalls, "path_stop_visits", "update").length, 0);
});

test("conditions does not load stops or legs it has no use for", async () => {
  await post({
    action: "conditions",
    claim_token: "spw_abc",
    session_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    crowd_level: "empty",
  });
  assert.equal(callsFor(sharedCalls, "shore_path_stops").length, 0);
  assert.equal(callsFor(sharedCalls, "path_legs").length, 0);
});

test("a refused visit does not spend a weather call", async () => {
  const res = await post({
    action: "visit",
    claim_token: "spw_abc",
    stop_slug: "fontana-beach",
    latitude: 42.5915,
    longitude: -88.4334,
    accuracy_m: 8,
  });
  assert.equal(res.status, 422);
  assert.equal(weatherFetch.requests.length, 0);
});
