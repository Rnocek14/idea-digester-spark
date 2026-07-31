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

const ENV: Record<string, string> = {
  ...TEST_ENV,
  NEWS_INGEST_SECRET: "news-secret",
};
const deno = installDeno(ENV);
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("ingest-news");
const handler = deno.handler();

const SOURCE_ROW = {
  id: "1cd38cc0-fb4f-4df5-a2cd-93a273abd4d1",
  name: "Lake Geneva Regional News",
  source_trust_score: 9,
  default_geo_tier: 1,
  metadata: {},
};

function defaultResolver(overrides: Partial<Record<string, Resolver>> = {}): Resolver {
  return (q) => {
    if (q.table === "sources" && q.op === "select") return { data: SOURCE_ROW };
    if (q.table === "content_queue" && q.op === "select") return { data: null }; // no duplicate
    if (q.table === "content_queue" && q.op === "insert") return { data: { id: "row-1" } };
    if (q.table === "sources" && q.op === "update") return {};
    if (q.table === "activity_log" && q.op === "insert") return {};
    const custom = overrides[`${q.table}:${q.op}`];
    return custom ? custom(q) : {};
  };
}

function authedRequest(body: unknown): Request {
  return makeRequest("/ingest-news", {
    body,
    headers: { Authorization: "Bearer news-secret" },
  });
}

const CLEAN_ARTICLE = {
  source: "lakegenevanews",
  url: "https://lakegenevanews.net/news/riviera-docks-reopen",
  title: "Riviera docks reopen for the summer season",
  content: "The Riviera docks reopened Friday with new slips and a fresh coat of paint.",
  summary: "Docks reopen downtown.",
  category: "news",
};

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = defaultResolver();
});

test("rejects unauthenticated requests", async () => {
  const res = await handler(makeRequest("/ingest-news", { body: CLEAN_ARTICLE }));
  assert.equal(res.status, 401);
});

test("clean article from trusted hyperlocal source auto-publishes with safety metadata", async () => {
  const res = await handler(authedRequest(CLEAN_ARTICLE));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "inserted");

  const inserts = callsFor(sharedCalls, "content_queue", "insert");
  assert.equal(inserts.length, 1);
  const row = inserts[0].payload as Record<string, unknown>;
  assert.equal(row.status, "auto_published");
  assert.equal(row.safety_level, "safe");
  assert.equal(row.decision_path, "ingest_trusted_auto");
  assert.equal(row.hold_reason, null);
});

test("publish_date falls back to ingestion time when the scraper found none", async () => {
  await handler(authedRequest({ ...CLEAN_ARTICLE, published_at: undefined }));
  const row = callsFor(sharedCalls, "content_queue", "insert")[0].payload as Record<string, unknown>;
  assert.ok(row.publish_date, "publish_date must never be null");
  assert.ok(!Number.isNaN(new Date(row.publish_date as string).getTime()));
});

test("provided published_at is preserved", async () => {
  await handler(authedRequest({ ...CLEAN_ARTICLE, published_at: "2026-07-30T12:00:00Z" }));
  const row = callsFor(sharedCalls, "content_queue", "insert")[0].payload as Record<string, unknown>;
  assert.equal(row.publish_date, "2026-07-30T12:00:00Z");
});

test("sensitive keyword holds the article for review", async () => {
  await handler(
    authedRequest({
      ...CLEAN_ARTICLE,
      url: "https://lakegenevanews.net/news/man-arrested-hwy-50",
      title: "Man arrested after Highway 50 pursuit",
      content: "A Lake Geneva man was arrested Tuesday following a pursuit on Highway 50.",
      summary: "",
    })
  );
  const row = callsFor(sharedCalls, "content_queue", "insert")[0].payload as Record<string, unknown>;
  assert.equal(row.status, "pending");
  assert.equal(row.safety_level, "sensitive");
  assert.equal(row.hold_reason, "sensitive_keyword_screen");
  assert.equal(row.decision_path, "ingest_keyword_hold");
  assert.ok((row.safety_tags as string[]).includes("keyword_screen"));
});

test("keyword match requires word boundaries — 'shotgun start' is not 'shot'", async () => {
  await handler(
    authedRequest({
      ...CLEAN_ARTICLE,
      url: "https://lakegenevanews.net/news/golf-outing",
      title: "Charity golf outing tees off with shotgun start",
      content: "The annual outing begins with a shotgun start at Grand Geneva.",
      summary: "",
    })
  );
  const row = callsFor(sharedCalls, "content_queue", "insert")[0].payload as Record<string, unknown>;
  assert.equal(row.status, "auto_published");
  assert.equal(row.safety_level, "safe");
});

test("non-hyperlocal source stays pending even when clean", async () => {
  await handler(authedRequest({ ...CLEAN_ARTICLE, geo_tier: 0 }));
  const row = callsFor(sharedCalls, "content_queue", "insert")[0].payload as Record<string, unknown>;
  assert.equal(row.status, "pending");
  assert.equal(row.safety_level, "soft_sensitive");
  assert.equal(row.hold_reason, "untrusted_tier");
});

test("duplicate URL is skipped without insert", async () => {
  currentResolver = (q) => {
    if (q.table === "sources" && q.op === "select") return { data: SOURCE_ROW };
    if (q.table === "content_queue" && q.op === "select") return { data: { id: "existing-1" } };
    return {};
  };
  const res = await handler(authedRequest(CLEAN_ARTICLE));
  const json = await res.json();
  assert.equal(json.status, "skipped");
  assert.equal(json.reason, "duplicate_url");
  assert.equal(callsFor(sharedCalls, "content_queue", "insert").length, 0);
});

test("zero-insert run does not clobber last_nonzero_run_at on the source", async () => {
  currentResolver = (q) => {
    if (q.table === "sources" && q.op === "select") return { data: SOURCE_ROW };
    if (q.table === "content_queue" && q.op === "select") return { data: { id: "existing-1" } };
    return {};
  };
  await handler(authedRequest(CLEAN_ARTICLE));
  const updates = callsFor(sharedCalls, "sources", "update");
  assert.equal(updates.length, 1);
  const payload = updates[0].payload as Record<string, unknown>;
  assert.ok(!("last_nonzero_run_at" in payload), "must not write last_nonzero_run_at on a zero-insert run");
  assert.ok(!("consecutive_zero_runs" in payload), "must not reset zero-run counter on a zero-insert run");
});

test("successful insert resets zero-run health counters", async () => {
  await handler(authedRequest(CLEAN_ARTICLE));
  const payload = callsFor(sharedCalls, "sources", "update")[0].payload as Record<string, unknown>;
  assert.equal(payload.consecutive_zero_runs, 0);
  assert.equal(payload.health_severity, "ok");
  assert.ok(payload.last_nonzero_run_at);
});
