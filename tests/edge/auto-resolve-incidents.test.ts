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

await importBundle("auto-resolve-incidents");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function isStaleReviewSweep(q: QueryCall): boolean {
  return (
    q.table === "incidents" &&
    q.op === "update" &&
    q.filters.some((f) => f.m === "eq" && f.args[0] === "status" && f.args[1] === "pending_review")
  );
}

function resolveUpdateFor(id: string): Record<string, unknown> | undefined {
  const call = callsFor(sharedCalls, "incidents", "update").find(
    (c) => !isStaleReviewSweep(c) && c.filters.some((f) => f.m === "eq" && f.args[0] === "id" && f.args[1] === id)
  );
  return call?.payload as Record<string, unknown> | undefined;
}

test("stale pending_review is auto-rejected; developing ages out; fresh stays", async () => {
  currentResolver = (q) => {
    if (isStaleReviewSweep(q)) return { data: [{ id: "hold-1" }, { id: "hold-2" }] };
    if (q.table === "incidents" && q.op === "select") {
      return {
        data: [
          // traffic: maxAge 6h / silence 3h -> both exceeded, resolves
          { id: "a1", incident_type: "traffic", status: "active", started_at: hoursAgo(10), updated_at: hoursAgo(10), title: "Crash on Hwy 50" },
          // developing must age out on the same rules as active
          { id: "d1", incident_type: "accident", status: "developing", started_at: hoursAgo(8), updated_at: hoursAgo(8), title: "Two-car crash near Como" },
          // fresh police incident: 24h/6h rules -> stays live
          { id: "f1", incident_type: "police", status: "active", started_at: hoursAgo(1), updated_at: hoursAgo(1), title: "Road blocked for event" },
        ],
      };
    }
    if (q.table === "incident_updates" && q.op === "select") return { data: [] };
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.resolved, 2);
  assert.equal(body.checked, 3);

  const a1 = resolveUpdateFor("a1");
  assert.equal(a1?.status, "resolved");
  assert.equal(a1?.resolution_reason, "auto_timeout_traffic");
  const d1 = resolveUpdateFor("d1");
  assert.equal(d1?.status, "resolved");
  assert.equal(resolveUpdateFor("f1"), undefined);
});

test("the stale-review sweep targets only week-old holds", async () => {
  currentResolver = (q) => {
    if (isStaleReviewSweep(q)) {
      const lt = q.filters.find((f) => f.m === "lt" && f.args[0] === "created_at");
      assert.ok(lt, "sweep must filter on created_at");
      const cutoff = new Date(lt!.args[1] as string).getTime();
      const sevenDays = Date.now() - 7 * 24 * 3600_000;
      assert.ok(Math.abs(cutoff - sevenDays) < 60_000, "cutoff should be ~7 days ago");
      return { data: [] };
    }
    if (q.table === "incidents" && q.op === "select") return { data: [] };
    return {};
  };
  const res = await handler(makeRequest("/", { body: {} }));
  assert.equal(res.status, 200);
  const sweep = callsFor(sharedCalls, "incidents", "update").find(isStaleReviewSweep);
  assert.ok(sweep, "sweep ran");
  assert.equal((sweep!.payload as Record<string, unknown>).status, "rejected");
});

test("recent activity on an old incident prevents resolution", async () => {
  currentResolver = (q) => {
    if (isStaleReviewSweep(q)) return { data: [] };
    if (q.table === "incidents" && q.op === "select") {
      return {
        data: [
          { id: "a2", incident_type: "traffic", status: "active", started_at: hoursAgo(10), updated_at: hoursAgo(10), title: "Long cleanup on 12" },
        ],
      };
    }
    if (q.table === "incident_updates" && q.op === "select") {
      // A fresh update 1h ago: age exceeded but silence NOT exceeded -> keep live
      return { data: [{ incident_id: "a2", created_at: hoursAgo(1) }] };
    }
    return {};
  };
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.resolved, 0);
  assert.equal(resolveUpdateFor("a2"), undefined);
});
