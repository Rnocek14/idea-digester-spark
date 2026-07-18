import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  installFetchMock,
  makeRequest,
  callsFor,
  jsonResponse,
  TEST_ENV,
  importBundle,
  type Resolver,
  type QueryCall,
} from "./harness.ts";

// The fleet-loop pattern: one invocation serves every active city, each with
// its own API base, bbox, and city_id — and one city's failure never blocks
// the rest.

const deno = installDeno({ ...TEST_ENV, WISCONSIN_511_API_KEY: "k511" });
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("sync-511-traffic");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

const CITY_A = {
  id: "default",
  city_name: "Lake Geneva",
  county_name: "Walworth County",
  state_511_api_base: "https://511a.test/api",
  bbox: { minLat: 42.4, maxLat: 42.9, minLon: -88.8, maxLon: -88.2 },
  local_keywords: ["lake geneva"],
  non_local_keywords: [],
};
const CITY_B = {
  id: "madison-wi",
  city_name: "Madison",
  county_name: "Dane County",
  state_511_api_base: "https://511b.test/api",
  bbox: { minLat: 43.0, maxLat: 43.2, minLon: -89.6, maxLon: -89.2 },
  local_keywords: ["madison"],
  non_local_keywords: [],
};

// One statewide feed containing one event per city's area; each city must
// pick up ONLY its own event.
const STATEWIDE_EVENTS = [
  { ID: "evA", EventType: "accident", Headline: "Crash on County Road A", Description: "Two vehicles", RoadwayName: "CR-A", County: "Somewhere", Latitude: 42.6, Longitude: -88.5, StartTime: "2026-07-18T10:00:00Z" },
  { ID: "evB", EventType: "closure", Headline: "Bridge closed for inspection", Description: "Detour posted", RoadwayName: "CR-B", County: "Elsewhere", Latitude: 43.1, Longitude: -89.4, StartTime: "2026-07-18T11:00:00Z" },
];

function cityRows(q: QueryCall): boolean {
  return q.table === "city_config" && q.filters.some((f) => f.m === "eq" && f.args[1] === "active");
}

function incidentInsertsFor(cityId: string): Record<string, unknown>[] {
  return callsFor(sharedCalls, "incidents", "insert")
    .map((c) => c.payload as Record<string, unknown>)
    .filter((p) => p.city_id === cityId);
}

test("two active cities: per-city API base, geo isolation, per-city stamping", async () => {
  installFetchMock([
    { match: (u) => u.startsWith("https://511a.test/api/getevents"), respond: () => jsonResponse(STATEWIDE_EVENTS) },
    { match: (u) => u.startsWith("https://511b.test/api/getevents"), respond: () => jsonResponse(STATEWIDE_EVENTS) },
  ]);
  currentResolver = (q) => {
    if (cityRows(q)) return { data: [CITY_A, CITY_B] };
    if (q.table === "sources") return { data: null };
    if (q.table === "incidents" && q.op === "select") return { data: [] };
    if (q.table === "incidents" && q.op === "insert") return { data: { id: `inc-${Math.random()}` } };
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.cities.length, 2);
  assert.equal(body.created, 2);

  // City A got ONLY its own event, stamped with its city_id
  const aInserts = incidentInsertsFor("default");
  assert.equal(aInserts.length, 1);
  assert.equal(aInserts[0].title, "Crash on County Road A");
  // City B likewise
  const bInserts = incidentInsertsFor("madison-wi");
  assert.equal(bInserts.length, 1);
  assert.equal(bInserts[0].title, "Bridge closed for inspection");

  // Dedupe lookups were city-scoped
  const dedupeSelects = callsFor(sharedCalls, "incidents", "select");
  for (const sel of dedupeSelects) {
    assert.ok(
      sel.filters.some((f) => f.m === "eq" && f.args[0] === "city_id"),
      "incident dedupe query must be city-scoped"
    );
  }
});

test("a city without a 511 API base is skipped cleanly", async () => {
  installFetchMock([
    { match: (u) => u.startsWith("https://511a.test/api/getevents"), respond: () => jsonResponse([]) },
  ]);
  currentResolver = (q) => {
    if (cityRows(q)) return { data: [CITY_A, { ...CITY_B, state_511_api_base: null }] };
    if (q.table === "sources") return { data: null };
    if (q.table === "incidents" && q.op === "select") return { data: [] };
    return {};
  };
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.cities.length, 1);
  assert.equal(body.cities_skipped, 1);
});

test("one city's dead upstream never blocks the fleet", async () => {
  installFetchMock([
    // City A: every endpoint fails
    { match: (u) => u.startsWith("https://511a.test/api/"), respond: () => new Response("boom", { status: 500 }) },
    // City B: healthy
    { match: (u) => u.startsWith("https://511b.test/api/getevents"), respond: () => jsonResponse(STATEWIDE_EVENTS) },
  ]);
  currentResolver = (q) => {
    if (cityRows(q)) return { data: [CITY_A, CITY_B] };
    if (q.table === "sources" && q.op === "select") return { data: { id: "src-a" } };
    if (q.table === "incidents" && q.op === "select") return { data: [] };
    if (q.table === "incidents" && q.op === "insert") return { data: { id: "inc-b" } };
    return {};
  };
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.success, true);
  const cityA = body.cities.find((c: { city_id: string }) => c.city_id === "default");
  const cityB = body.cities.find((c: { city_id: string }) => c.city_id === "madison-wi");
  assert.equal(cityA.upstream_healthy, false);
  assert.equal(cityA.created, 0);
  assert.equal(cityB.created, 1);

  // Unhealthy upstream marks the city's source row warning (self-reporting health)
  const srcUpdates = callsFor(sharedCalls, "sources", "update").map((c) => c.payload as Record<string, unknown>);
  assert.ok(srcUpdates.some((p) => p.health_severity === "warning"));
});
