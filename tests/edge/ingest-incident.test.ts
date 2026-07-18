import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  installFetchMock,
  makeRequest,
  callsFor,
  TEST_ENV,
  importBundle,
  type Resolver,
  type QueryCall,
} from "./harness.ts";

// No LOVABLE_API_KEY: Tier-2 AI rewrite is unavailable, which must fail closed
// (tier 2 -> pending_review), and Tier-1/Tier-4 paths must be unaffected.
const deno = installDeno({ ...TEST_ENV, CIVIC_INGEST_SECRET: "topsecret" });
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("ingest-incident");
const handler = deno.handler();

const authed = { "x-ingest-secret": "topsecret" };

// Default resolver: config falls back to Lake Geneva defaults, no learned
// rules, no similar incidents, inserts succeed.
function baseResolver(q: QueryCall) {
  if (q.table === "city_config") return { error: { message: "no row" } };
  if (q.table === "incident_reject_rules") return { data: [] };
  if (q.table === "incidents" && q.op === "select") return { data: q.single ? null : [] };
  if (q.table === "incidents" && q.op === "insert") return { data: { id: "new-1" } };
  return {};
}

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = baseResolver;
  installFetchMock([]); // any unexpected network call fails loudly with 404
});

test("rejects wrong ingest secret", async () => {
  const res = await handler(
    makeRequest("/", { body: { source: "x" }, headers: { "x-ingest-secret": "wrong" } })
  );
  assert.equal(res.status, 401);
});

test("schema validation failures are reported per item", async () => {
  const res = await handler(
    makeRequest("/", { body: { items: [{ source: "scanner", external_id: "e0", title: "ab" }] }, headers: authed })
  );
  assert.equal(res.status, 200);
  const { results } = await res.json();
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error, "validation");
});

test("non-local content from untrusted source is geo-gated out", async () => {
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "scanner",
        source_type: "rss",
        external_id: "e1",
        title: "Something happened downtown",
        body: "no recognizable local place names here",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error, "out_of_geo");
  assert.equal(callsFor(sharedCalls, "incidents", "insert").length, 0);
});

test("Tier-4 content is dropped, never inserted", async () => {
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "scanner",
        source_type: "facebook",
        external_id: "e2",
        title: "Arrest made after chase near Lake Geneva",
        body: "Suspect arrested on Hwy 50",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].ok, true);
  assert.equal(results[0].rejected, true);
  assert.equal(results[0].tier, 4);
  assert.equal(callsFor(sharedCalls, "incidents", "insert").length, 0);
  assert.equal(callsFor(sharedCalls, "incident_updates", "insert").length, 0);
});

test("Tier-1 content publishes immediately with city_id + confidence", async () => {
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "city-official",
        source_type: "official",
        external_id: "e3",
        title: "Road closed on Wrigley Drive for repairs",
        body: "Road closed between Broad and Center through Friday",
        location: "Lake Geneva",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].ok, true);
  assert.equal(results[0].tier, 1);
  assert.equal(results[0].status, "active");
  assert.equal(results[0].confidence, 95); // official baseline

  const insert = callsFor(sharedCalls, "incidents", "insert")[0].payload as Record<string, unknown>;
  assert.equal(insert.city_id, "default");
  assert.equal(insert.status, "active");
  assert.equal(insert.tier, 1);
  // Multi-source observation recorded
  assert.equal(callsFor(sharedCalls, "incident_source_observations", "insert").length, 1);
});

test("Tier-2 fails closed to pending_review when AI rewrite is unavailable", async () => {
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "scanner",
        source_type: "facebook",
        external_id: "e4",
        title: "Kitchen fire at restaurant near Lake Geneva",
        body: "Small kitchen fire, quickly out",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].ok, true);
  assert.equal(results[0].status, "pending_review");
  const insert = callsFor(sharedCalls, "incidents", "insert")[0].payload as Record<string, unknown>;
  assert.equal(insert.hold_reason, "ai_rewrite_failed");
});

test("learned reject rules override everything", async () => {
  currentResolver = (q) => {
    if (q.table === "incident_reject_rules") return { data: [{ keyword: "ladies night" }] };
    return baseResolver(q);
  };
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "scanner",
        source_type: "facebook",
        external_id: "e5",
        title: "Ladies Night at the pier in Lake Geneva",
        body: "traffic expected",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].rejected, true);
  assert.match(String(results[0].hold_reason), /^learned_rule:/);
  assert.equal(callsFor(sharedCalls, "incidents", "insert").length, 0);
});

test("duplicate (source, external_id) dedupes without inserting", async () => {
  currentResolver = (q) => {
    if (q.table === "incidents" && q.op === "select" && q.single) return { data: { id: "existing-1" } };
    return baseResolver(q);
  };
  const res = await handler(
    makeRequest("/", {
      body: {
        source: "scanner",
        source_type: "facebook",
        external_id: "e6",
        title: "Tree down blocking Main St in Lake Geneva",
      },
      headers: authed,
    })
  );
  const { results } = await res.json();
  assert.equal(results[0].deduped, true);
  assert.equal(results[0].id, "existing-1");
  assert.equal(callsFor(sharedCalls, "incidents", "insert").length, 0);
});
