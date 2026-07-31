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

const ENV: Record<string, string> = { ...TEST_ENV };
const deno = installDeno(ENV);
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("alert-source-health");
const handler = deno.handler();

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const HEALTHY_SOURCE = {
  id: "s1",
  name: "Healthy Feed",
  type: "rss",
  category: "news",
  status: "active",
  health_severity: "ok",
  consecutive_zero_runs: 0,
  last_successful_fetch_at: hoursAgo(1),
  last_nonzero_run_at: hoursAgo(2),
  last_error_code: null,
  last_error_detail: null,
};

const DISABLED_SOURCE = {
  ...HEALTHY_SOURCE,
  id: "s2",
  name: "Paper of Record",
  status: "error",
  health_severity: "ok",
};

// The function issues two content_queue reads: newest-ingested (no `in`
// filters) and newest-live (filtered by status + safety_level via `in`).
function makeResolver(opts: {
  sources: unknown[];
  ingestedAt?: string | null;
  liveAt?: string | null;
  recentAlerts?: number;
}): Resolver {
  return (q) => {
    if (q.table === "sources" && q.op === "select") return { data: opts.sources };
    if (q.table === "content_queue" && q.op === "select") {
      const isLiveQuery = q.filters.some((f) => f.m === "in");
      const at = isLiveQuery ? opts.liveAt : opts.ingestedAt;
      return { data: at === null ? null : { created_at: at ?? hoursAgo(1) } };
    }
    if (q.table === "activity_log" && q.op === "select") return { count: opts.recentAlerts ?? 0 };
    if (q.table === "activity_log" && q.op === "insert") return {};
    return {};
  };
}

function logInserts(action: string): QueryCall[] {
  return callsFor(sharedCalls, "activity_log", "insert").filter(
    (c) => (c.payload as Record<string, unknown>).action === action
  );
}

let resendSends: Array<Record<string, unknown>> = [];

beforeEach(() => {
  sharedCalls.length = 0;
  resendSends = [];
  (globalThis as Record<string, unknown>).__resendSend = (args: unknown) => {
    resendSends.push(args as Record<string, unknown>);
    return { data: { id: "mock" }, error: null };
  };
  delete ENV.ALERT_EMAIL;
  delete ENV.RESEND_API_KEY;
});

test("all healthy and fresh: logs a snapshot, sends nothing", async () => {
  currentResolver = makeResolver({ sources: [HEALTHY_SOURCE] });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.unhealthy, 0);
  assert.equal(logInserts("source_health_check").length, 1);
  assert.equal(logInserts("source_health_alert").length, 0);
  assert.equal(resendSends.length, 0);
});

test("auto-disabled (status=error) source counts as unhealthy", async () => {
  currentResolver = makeResolver({ sources: [HEALTHY_SOURCE, DISABLED_SOURCE] });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(json.unhealthy, 1);
  assert.deepEqual(json.auto_disabled, ["Paper of Record"]);
  // Sources query must not be scoped to active only
  const sourceQuery = callsFor(sharedCalls, "sources", "select")[0];
  const inFilter = sourceQuery.filters.find((f) => f.m === "in");
  assert.ok(inFilter, "sources query should use .in() to include error status");
  assert.deepEqual(inFilter!.args[1], ["active", "error"]);
});

test("attention needed without email secrets still logs the snapshot (no silent no-op)", async () => {
  currentResolver = makeResolver({ sources: [DISABLED_SOURCE] });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(json.skipped, "email_not_configured");
  const checks = logInserts("source_health_check");
  assert.equal(checks.length, 1);
  const details = (checks[0].payload as Record<string, unknown>).details as Record<string, unknown>;
  assert.deepEqual(details.auto_disabled, ["Paper of Record"]);
  assert.equal(resendSends.length, 0);
});

test("stale live story alerts even when every source looks healthy", async () => {
  ENV.ALERT_EMAIL = "ops@example.com";
  ENV.RESEND_API_KEY = "rk";
  currentResolver = makeResolver({
    sources: [HEALTHY_SOURCE],
    ingestedAt: hoursAgo(1),
    liveAt: hoursAgo(30), // beyond the 24h live-story threshold
  });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(json.live_story_stale, true);
  assert.equal(json.emailed, true);
  assert.equal(resendSends.length, 1);
  assert.match(String(resendSends[0].subject), /feed stale/);
  assert.equal(logInserts("source_health_alert").length, 1);
});

test("fresh content within thresholds does not trip staleness", async () => {
  currentResolver = makeResolver({
    sources: [HEALTHY_SOURCE],
    ingestedAt: hoursAgo(2),
    liveAt: hoursAgo(10),
  });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(json.ingest_stale, false);
  assert.equal(json.live_story_stale, false);
});

test("email rate limit still applies", async () => {
  ENV.ALERT_EMAIL = "ops@example.com";
  ENV.RESEND_API_KEY = "rk";
  currentResolver = makeResolver({ sources: [DISABLED_SOURCE], recentAlerts: 1 });
  const res = await handler(makeRequest("/alert-source-health", {}));
  const json = await res.json();
  assert.equal(json.skipped, "alert already sent recently");
  assert.equal(resendSends.length, 0);
  // but the snapshot is still recorded
  assert.equal(logInserts("source_health_check").length, 1);
});
