import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  installFetchMock,
  makeRequest,
  callsFor,
  rssResponse,
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

await importBundle("validate-trial-sources");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

function updateFor(id: string): Record<string, unknown> | undefined {
  const call = callsFor(sharedCalls, "sources", "update").find((c) =>
    c.filters.some((f) => f.m === "eq" && f.args[0] === "id" && f.args[1] === id)
  );
  return call?.payload as Record<string, unknown> | undefined;
}

test("the full grading matrix: promote/park/demote/pending", async () => {
  installFetchMock([
    { match: (u) => u.startsWith("https://a.test/feed"), respond: () => rssResponse(3) },
    { match: (u) => u.startsWith("https://b.test/feed"), respond: () => rssResponse(2) },
    { match: (u) => u.startsWith("https://c.test/feed"), respond: () => new Response("gone", { status: 404 }) },
    {
      match: (u) => u.startsWith("https://d.test/page"),
      respond: () => new Response("<html><body>hello</body></html>", { status: 200 }),
    },
  ]);

  currentResolver = (q) => {
    if (q.table === "sources" && q.op === "select") {
      return {
        data: [
          // 2nd success for the live city -> active
          { id: "s1", name: "A", url: "https://a.test/feed", type: "rss", city_id: "default", metadata: { trial: { successes: 1, failures: 0 } } },
          // 2nd success for a NOT-live city -> ready (must not leak content)
          { id: "s2", name: "B", url: "https://b.test/feed", type: "rss", city_id: "delavan-wi", metadata: { trial: { successes: 1, failures: 0 } } },
          // 5th consecutive failure -> inactive
          { id: "s3", name: "C", url: "https://c.test/feed", type: "rss", city_id: "default", metadata: { trial: { successes: 0, failures: 4 } } },
          // HTTP 200 but NOT a feed -> counts as failure, stays trial
          { id: "s4", name: "D", url: "https://d.test/page", type: "rss", city_id: "default", metadata: {} },
        ],
      };
    }
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.checked, 4);
  assert.equal(body.promoted, 2);
  assert.equal(body.demoted, 1);
  assert.equal(body.pending, 1);

  assert.equal(updateFor("s1")?.status, "active");
  assert.equal(updateFor("s2")?.status, "ready");
  assert.equal(updateFor("s3")?.status, "inactive");
  assert.equal(updateFor("s4")?.status, "trial");

  // Demoted source carries the auto-retire marker
  const s3meta = updateFor("s3")?.metadata as Record<string, unknown>;
  assert.equal(s3meta.retired, true);

  // Non-feed 200 recorded as failure, not success
  const s4meta = updateFor("s4")?.metadata as { trial: { successes: number; failures: number } };
  assert.equal(s4meta.trial.successes, 0);
  assert.equal(s4meta.trial.failures, 1);

  // A success resets the failure streak
  const s1meta = updateFor("s1")?.metadata as { trial: { successes: number; failures: number } };
  assert.equal(s1meta.trial.successes, 2);
  assert.equal(s1meta.trial.failures, 0);

  // Audit row written
  assert.equal(callsFor(sharedCalls, "activity_log", "insert").length, 1);
});

test("no trial sources -> clean no-op", async () => {
  installFetchMock([]);
  currentResolver = (q) => {
    if (q.table === "sources" && q.op === "select") return { data: [] };
    return {};
  };
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.checked, 0);
  assert.equal(callsFor(sharedCalls, "sources", "update").length, 0);
  assert.equal(callsFor(sharedCalls, "activity_log", "insert").length, 0);
});
