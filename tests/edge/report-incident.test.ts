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

await importBundle("report-incident");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = () => undefined;
});

function isIpCountQuery(q: QueryCall): boolean {
  return (
    q.table === "activity_log" &&
    q.head === true &&
    q.filters.some((f) => f.m === "eq" && f.args[0] === "details->>ip_hash")
  );
}

function isGlobalCountQuery(q: QueryCall): boolean {
  return q.table === "activity_log" && q.head === true && !isIpCountQuery(q);
}

test("rejects non-POST", async () => {
  const res = await handler(makeRequest("/", { method: "GET" }));
  assert.equal(res.status, 405);
});

test("rejects empty/unknown symptoms", async () => {
  const res = await handler(
    makeRequest("/", { body: { symptoms: ["not-a-real-symptom"], location_choice: "Hwy 50" } })
  );
  assert.equal(res.status, 400);
});

test("rate-limits per IP", async () => {
  currentResolver = (q) => {
    if (isGlobalCountQuery(q)) return { count: 0 };
    if (isIpCountQuery(q)) return { count: 3 };
    return undefined;
  };
  const res = await handler(
    makeRequest("/", {
      body: { symptoms: ["crash"], location_choice: "Hwy 50" },
      headers: { "x-forwarded-for": "1.2.3.4" },
    })
  );
  assert.equal(res.status, 429);
  // Nothing was written
  assert.equal(callsFor(sharedCalls, "incidents", "insert").length, 0);
});

test("rate-limits globally", async () => {
  currentResolver = (q) => {
    if (isGlobalCountQuery(q)) return { count: 12 };
    return undefined;
  };
  const res = await handler(
    makeRequest("/", { body: { symptoms: ["smoke"], location_choice: "Near the lake" } })
  );
  assert.equal(res.status, 429);
});

test("happy path: inserts incident + unverified update + audit row, stamped with city_id", async () => {
  currentResolver = (q) => {
    if (q.table === "activity_log" && q.head) return { count: 0 };
    if (q.table === "city_config") return { error: { message: "no row" } }; // falls back to defaults
    if (q.table === "incidents" && q.op === "insert") {
      return { data: { id: "inc-1", ...(q.payload as object) } };
    }
    return {};
  };

  const res = await handler(
    makeRequest("/", {
      body: {
        symptoms: ["crash", "police"],
        location_choice: "Hwy 50",
        location_note: "near the roundabout",
        extra_info: "Traffic backing up both directions",
      },
      headers: { "x-forwarded-for": "5.6.7.8" },
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  const inserts = callsFor(sharedCalls, "incidents", "insert");
  assert.equal(inserts.length, 1);
  const payload = inserts[0].payload as Record<string, unknown>;
  assert.equal(payload.city_id, "default");
  assert.equal(payload.status, "active");
  assert.equal(payload.incident_type, "accident"); // first symptom wins
  assert.equal(payload.location, "Hwy 50 (near the roundabout)");
  assert.match(String(payload.title), /^Community report: crash/);

  const updates = callsFor(sharedCalls, "incident_updates", "insert");
  assert.equal(updates.length, 1);
  const upd = updates[0].payload as Record<string, unknown>;
  assert.equal(upd.is_verified, false);
  assert.match(String(upd.text), /Traffic backing up/);

  const audit = callsFor(sharedCalls, "activity_log", "insert");
  assert.equal(audit.length, 1);
  assert.equal((audit[0].payload as Record<string, unknown>).action, "community_report");
});

test("free-text length is capped", async () => {
  currentResolver = (q) => {
    if (q.table === "activity_log" && q.head) return { count: 0 };
    if (q.table === "city_config") return { error: { message: "no row" } };
    if (q.table === "incidents" && q.op === "insert") return { data: { id: "inc-2" } };
    return {};
  };
  const res = await handler(
    makeRequest("/", {
      body: { symptoms: ["other"], location_choice: "Not sure / Other", extra_info: "x".repeat(5000) },
    })
  );
  assert.equal(res.status, 200);
  const upd = callsFor(sharedCalls, "incident_updates", "insert")[0].payload as Record<string, string>;
  assert.ok(upd.text.length < 600, `update text should be capped, got ${upd.text.length}`);
});
