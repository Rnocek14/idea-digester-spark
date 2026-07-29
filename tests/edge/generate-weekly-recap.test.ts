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

const deno = installDeno({ ...TEST_ENV, OPENAI_API_KEY: "sk-test" });
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("generate-weekly-recap");
const handler = deno.handler();

const CITY_A = { id: "default", city_name: "Lake Geneva", state_code: "WI", site_name: "Lake Geneva Brief", timezone: "America/Chicago" };
const CITY_B = { id: "delavan-wi", city_name: "Delavan", state_code: "WI", site_name: "Delavan Brief", timezone: "America/Chicago" };

function story(id: string, title: string, category = "news") {
  return { id, title, summary: `${title} summary`, category, geo_label: "Lake Geneva", publish_date: "2026-07-15T10:00:00Z" };
}

let capturedPrompts: Array<{ system: string; user: string }> = [];

function mockOpenAI(content = "It was a busy week at city hall.\n\nElsewhere, the schools moved ahead.") {
  capturedPrompts = [];
  installFetchMock([
    {
      match: (u) => u.includes("api.openai.com"),
      respond: (_u, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedPrompts.push({
          system: body.messages.find((m: { role: string }) => m.role === "system").content,
          user: body.messages.find((m: { role: string }) => m.role === "user").content,
        });
        return jsonResponse({ choices: [{ message: { content } }] });
      },
    },
  ]);
}

function upsertPayloads() {
  return callsFor(sharedCalls, "weekly_recaps", "upsert").map((c) => c.payload as Record<string, unknown>);
}

beforeEach(() => {
  sharedCalls.length = 0;
});

test("publishes a recap scoped and stamped per city", async () => {
  mockOpenAI();
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: null };
    if (q.table === "content_queue") return { data: [story("s1", "Council approves budget"), story("s2", "New bakery opens", "business"), story("s3", "School board vote", "schools"), story("s4", "Road work on Hwy 50", "civic"), story("s5", "Beach cleanup", "community")] };
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.cities[0].published, true);
  assert.equal(body.cities[0].story_count, 5);
  assert.equal(body.cities[0].is_quiet_week, false);

  const payload = upsertPayloads().at(-1)!;
  assert.equal(payload.city_id, "default");
  assert.equal(payload.status, "published");
  assert.equal(payload.story_count, 5);
  assert.equal((payload.mentioned_story_ids as string[]).length, 5);
  assert.match(String(payload.body), /busy week at city hall/);

  // Content query is city-scoped and restricted to already-published stories
  const cq = callsFor(sharedCalls, "content_queue", "select")[0];
  assert.ok(cq.filters.some((f) => f.m === "eq" && f.args[0] === "city_id" && f.args[1] === "default"));
  const statusFilter = cq.filters.find((f) => f.m === "in" && f.args[0] === "status");
  assert.deepEqual([...(statusFilter!.args[1] as string[])].sort(), ["auto_published", "published"]);
});

test("quiet week: prompt forbids inflating thin material", async () => {
  mockOpenAI("Slow week on the lake, and that's usually good news.");
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: null };
    if (q.table === "content_queue") return { data: [story("s1", "One small thing")] };
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.cities[0].is_quiet_week, true);

  const system = capturedPrompts[0].system;
  assert.match(system, /QUIET WEEK/i);
  assert.match(system, /Do NOT stretch thin material/i);
  assert.match(capturedPrompts[0].user, /QUIET_WEEK: true/);

  const payload = upsertPayloads().at(-1)!;
  assert.equal(payload.is_quiet_week, true);
  assert.equal(payload.headline, "A quiet week");
});

test("zero stories: records skipped, publishes nothing, calls no AI", async () => {
  mockOpenAI();
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: null };
    if (q.table === "content_queue") return { data: [] };
    return {};
  };

  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.cities[0].skipped, "no_stories");
  assert.equal(capturedPrompts.length, 0, "must not spend an AI call on an empty week");

  const payload = upsertPayloads().at(-1)!;
  assert.equal(payload.status, "skipped");
  assert.equal(payload.body, "");
});

test("idempotent: an already-published week is skipped unless forced", async () => {
  mockOpenAI();
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: { id: "r1", status: "published" } };
    if (q.table === "content_queue") return { data: [story("s1", "Something")] };
    return {};
  };

  const first = await (await handler(makeRequest("/", { body: {} }))).json();
  assert.equal(first.cities[0].skipped, "already_generated");
  assert.equal(capturedPrompts.length, 0);

  sharedCalls.length = 0;
  const forced = await (await handler(makeRequest("/", { body: { force: true } }))).json();
  assert.equal(forced.cities[0].published, true);
  assert.equal(capturedPrompts.length, 1);
});

test("prompt is desk-voiced and source-bound (no invented facts, no persona)", async () => {
  mockOpenAI();
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: null };
    if (q.table === "content_queue") return { data: [story("s1", "A"), story("s2", "B"), story("s3", "C"), story("s4", "D")] };
    return {};
  };
  await handler(makeRequest("/", { body: {} }));
  const system = capturedPrompts[0].system;
  assert.match(system, /Use ONLY the stories provided/i);
  assert.match(system, /Never invent facts/i);
  assert.match(system, /newsroom desk, not a named person/i);
  assert.match(system, /Lake Geneva Brief/);
});

test("fleet: each city gets its own recap and one failure doesn't block the other", async () => {
  capturedPrompts = [];
  installFetchMock([
    {
      match: (u) => u.includes("api.openai.com"),
      respond: (_u, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const system = body.messages[0].content;
        capturedPrompts.push({ system, user: body.messages[1].content });
        // Fail only for Delavan
        return system.includes("Delavan")
          ? new Response("rate limited", { status: 429 })
          : jsonResponse({ choices: [{ message: { content: "Lake Geneva had a week." } }] });
      },
    },
  ]);
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [CITY_A, CITY_B] };
    if (q.table === "weekly_recaps" && q.op === "select") return { data: null };
    if (q.table === "content_queue") return { data: [story("s1", "A"), story("s2", "B"), story("s3", "C"), story("s4", "D")] };
    return {};
  };

  const body = await (await handler(makeRequest("/", { body: {} }))).json();
  assert.equal(body.success, true);
  assert.equal(body.cities.length, 2);
  const lg = body.cities.find((c: { city_id: string }) => c.city_id === "default");
  const dv = body.cities.find((c: { city_id: string }) => c.city_id === "delavan-wi");
  assert.equal(lg.published, true);
  assert.ok(dv.error, "failing city reports an error rather than throwing the run");

  // The failure is persisted as a draft with the reason, not silently lost
  const drafts = upsertPayloads().filter((p) => p.status === "draft");
  assert.equal(drafts.length, 1);
  assert.match(String(drafts[0].generation_error), /openai 429/);
});
