import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  installFetchMock,
  makeRequest,
  callsFor,
  rssResponse,
  jsonResponse,
  TEST_ENV,
  importBundle,
  type Resolver,
  type QueryCall,
} from "./harness.ts";

// No OPENAI_API_KEY / FIRECRAWL_API_KEY: the AI and search tiers must
// gracefully skip and the deterministic tiers must still work.
const deno = installDeno({ ...TEST_ENV });
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("bootstrap-city");
const handler = deno.handler();

const adminHeaders = { Authorization: `Bearer ${TEST_ENV.SUPABASE_SERVICE_ROLE_KEY}` };

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = () => undefined;
});

test("rejects unauthenticated calls", async () => {
  const res = await handler(makeRequest("/", { body: { city_name: "X", state_code: "WI", county_name: "Y" } }));
  assert.equal(res.status, 401);
});

test("rejects missing required fields", async () => {
  const res = await handler(makeRequest("/", { body: { city_name: "Testville" }, headers: adminHeaders }));
  assert.equal(res.status, 400);
});

test("full deterministic bootstrap: geocode, NWS zones, probes, trial sources", async () => {
  installFetchMock([
    {
      match: (u) => u.startsWith("https://geocoding-api.open-meteo.com/"),
      respond: () =>
        jsonResponse({
          results: [
            { latitude: 40.0, longitude: -100.0, admin1: "Illinois", country_code: "US" },
            { latitude: 42.6, longitude: -88.7, admin1: "Wisconsin", country_code: "US" },
          ],
        }),
    },
    {
      match: (u) => u.startsWith("https://api.weather.gov/points/"),
      respond: () =>
        jsonResponse({
          properties: {
            forecastZone: "https://api.weather.gov/zones/forecast/WIZ063",
            county: "https://api.weather.gov/zones/county/WIC127",
          },
        }),
    },
    { match: (u) => u === "https://patch.com/wisconsin/testville", respond: () => new Response("patch page", { status: 200 }) },
    { match: (u) => u === "https://www.cityoftestville.gov", respond: () => new Response("<html>city site</html>", { status: 200 }) },
    {
      match: (u) => u === "https://www.cityoftestville.gov/CivicAlerts.aspx?Format=RSS",
      respond: () => rssResponse(2),
    },
    // all other gov base guesses fall through to the harness default 404
  ]);

  currentResolver = (q) => {
    if (q.table === "city_config" && q.op === "insert") return {};
    if (q.table === "source_discovery_runs" && q.op === "insert") return { data: { id: "run-1" } };
    if (q.table === "sources" && q.op === "upsert") return {};
    if (q.table === "source_discovery_runs" && q.op === "update") return {};
    return {};
  };

  const res = await handler(
    makeRequest("/", {
      body: { city_name: "Testville", state_code: "WI", county_name: "Walworth County" },
      headers: adminHeaders,
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.city_id, "testville-wi");

  // Geocoding picked the state-matching result, not the first one
  assert.equal(body.geocode.lat, 42.6);

  // city_config payload
  const cfg = callsFor(sharedCalls, "city_config", "insert")[0].payload as Record<string, unknown>;
  assert.equal(cfg.id, "testville-wi");
  assert.equal(cfg.status, "bootstrapping");
  assert.deepEqual(cfg.nws_zones, ["WIZ063", "WIC127"]);
  assert.equal(cfg.spotcrime_path, "WI/Walworth%20County");
  assert.equal(cfg.state_511_api_base, "https://511wi.gov/api");
  const bbox = cfg.bbox as { minLat: number; maxLat: number };
  assert.ok(Math.abs(bbox.minLat - (42.6 - 0.18)) < 1e-9);
  // Deterministic gazetteer floor without AI
  const kws = cfg.local_keywords as string[];
  assert.ok(kws.includes("testville"));
  assert.ok(kws.includes("walworth county"));

  // Discovered sources: google news (trial, discovery-layer), patch (candidate), civic alerts (trial)
  const upserts = callsFor(sharedCalls, "sources", "upsert").map((c) => c.payload as Record<string, unknown>);
  assert.equal(upserts.length, 3);
  assert.equal(body.sources_inserted, 3);

  const gnews = upserts.find((s) => String(s.name).startsWith("Google News"));
  assert.ok(gnews, "google news source missing");
  assert.equal(gnews!.status, "trial");
  assert.equal(gnews!.city_id, "testville-wi");
  assert.equal((gnews!.metadata as Record<string, unknown>).discovery_layer, "true");

  const patch = upserts.find((s) => String(s.name).startsWith("Patch"));
  assert.ok(patch, "patch source missing");
  assert.equal(patch!.status, "candidate"); // scrape types are never auto-validated

  const civic = upserts.find((s) => String(s.name).includes("Civic Alerts"));
  assert.ok(civic, "civic alerts source missing");
  assert.equal(civic!.status, "trial");
  assert.equal(civic!.url, "https://www.cityoftestville.gov/CivicAlerts.aspx?Format=RSS");

  // Graceful skips are reported
  assert.match(String(body.firecrawl), /skipped/);

  // Discovery run completed
  const runUpdate = callsFor(sharedCalls, "source_discovery_runs", "update")[0];
  assert.equal((runUpdate.payload as Record<string, unknown>).status, "completed");
});

test("dead city gov + no patch -> only google news, still succeeds", async () => {
  installFetchMock([
    {
      match: (u) => u.startsWith("https://geocoding-api.open-meteo.com/"),
      respond: () => jsonResponse({ results: [{ latitude: 43.1, longitude: -89.5, admin1: "Wisconsin", country_code: "US" }] }),
    },
    { match: (u) => u.startsWith("https://api.weather.gov/points/"), respond: () => jsonResponse({ properties: {} }) },
    // everything else 404s
  ]);
  currentResolver = (q) => {
    if (q.table === "source_discovery_runs" && q.op === "insert") return { data: { id: "run-2" } };
    return {};
  };
  const res = await handler(
    makeRequest("/", {
      body: { city_name: "Nowhereville", state_code: "WI", county_name: "Dane County" },
      headers: adminHeaders,
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.nws_zones, []);
  const upserts = callsFor(sharedCalls, "sources", "upsert");
  assert.equal(upserts.length, 1); // just the google news discovery feed
});

test("unresolvable geocode returns 422 and writes nothing", async () => {
  installFetchMock([
    { match: (u) => u.startsWith("https://geocoding-api.open-meteo.com/"), respond: () => jsonResponse({ results: [] }) },
  ]);
  const res = await handler(
    makeRequest("/", {
      body: { city_name: "Zzyzzx", state_code: "WI", county_name: "Nowhere County" },
      headers: adminHeaders,
    })
  );
  assert.equal(res.status, 422);
  assert.equal(callsFor(sharedCalls, "city_config", "insert").length, 0);
});
