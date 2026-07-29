import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  makeRequest,
  callsFor,
  TEST_ENV,
  importBundle,
  type Resolver,
  type QueryCall,
} from "./harness.ts";

const deno = installDeno({ ...TEST_ENV });
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
    if (q.table === "path_stop_visits" && q.head) return { count: o.visitsToday ?? 0 };
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
