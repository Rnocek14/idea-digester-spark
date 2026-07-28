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

// Single shared env object — installDeno closes over it, so tests toggle keys
// here rather than re-installing the shim (which would clobber the handler).
const ENV: Record<string, string> = {
  ...TEST_ENV,
  CIVIC_INGEST_SECRET: "ingest-secret",
  GMAIL_CLIENT_ID: "cid",
  GMAIL_CLIENT_SECRET: "csecret",
  GMAIL_REFRESH_TOKEN: "rtoken",
};
const deno = installDeno(ENV);
let currentResolver: Resolver = () => undefined;
const sharedCalls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    sharedCalls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("ingest-email");
const handler = deno.handler();

const b64url = (s: string) =>
  Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const SOURCES = [
  {
    id: "s1",
    name: "Nixle – Walworth County (email)",
    city_id: "default",
    status: "active",
    category: "safety",
    metadata: { email_from: "alerts@nixle.com", email_source_type: "nixle" },
  },
  {
    id: "s2",
    name: "Retired list",
    city_id: "default",
    status: "inactive",
    category: "safety",
    metadata: { email_from: "old@example.com" },
  },
];

function gmailMessage(id: string, from: string, subject: string, bodyText: string) {
  return {
    id,
    payload: {
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: subject },
        { name: "Date", value: "Sat, 18 Jul 2026 14:05:00 -0500" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64url(`<p>${bodyText}</p>`) } },
        { mimeType: "text/plain", body: { data: b64url(bodyText) } },
      ],
    },
  };
}

beforeEach(() => {
  sharedCalls.length = 0;
  ENV.GMAIL_REFRESH_TOKEN = "rtoken";
  currentResolver = (q) => (q.table === "sources" ? { data: SOURCES } : {});
});

function mockGmail(messages: Record<string, unknown>[], ingestOk = true) {
  const ingestCalls: Array<Record<string, unknown>> = [];
  const modifyCalls: string[] = [];
  installFetchMock([
    { match: (u) => u.includes("oauth2.googleapis.com/token"), respond: () => jsonResponse({ access_token: "at" }) },
    {
      match: (u) => u.includes("/messages?q="),
      respond: () => jsonResponse({ messages: messages.map((m) => ({ id: (m as { id: string }).id })) }),
    },
    {
      match: (u) => /\/messages\/[^/]+\?format=full/.test(u),
      respond: (u) => {
        const id = u.match(/\/messages\/([^/?]+)/)![1];
        const msg = messages.find((m) => (m as { id: string }).id === id);
        return msg ? jsonResponse(msg) : new Response("nope", { status: 404 });
      },
    },
    {
      match: (u) => u.includes("/modify"),
      respond: (u) => {
        modifyCalls.push(u.match(/\/messages\/([^/]+)\/modify/)![1]);
        return jsonResponse({ ok: true });
      },
    },
    {
      match: (u) => u.includes("/functions/v1/ingest-incident"),
      respond: (_u, init) => {
        ingestCalls.push(JSON.parse(String(init?.body ?? "{}")));
        return ingestOk ? jsonResponse({ results: [{ ok: true }] }) : new Response("boom", { status: 500 });
      },
    },
  ]);
  return { ingestCalls, modifyCalls };
}

test("no-ops gracefully when Gmail is not configured", async () => {
  delete ENV.GMAIL_REFRESH_TOKEN;
  installFetchMock([]);
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.skipped, "gmail_not_configured");
});

test("known sender is routed through ingest-incident and marked read", async () => {
  const { ingestCalls, modifyCalls } = mockGmail([
    gmailMessage("m1", "Walworth Alerts <alerts@nixle.com>", "Road closed on Hwy 50", "Crash at Hwy 50 and Como. Expect delays."),
  ]);
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.ingested, 1);
  assert.equal(body.unknown_sender, 0);

  assert.equal(ingestCalls.length, 1);
  const payload = ingestCalls[0];
  assert.equal(payload.source_type, "nixle"); // high-confidence baseline
  assert.equal(payload.external_id, "gmail-m1");
  assert.equal(payload.title, "Road closed on Hwy 50");
  assert.match(String(payload.body), /Crash at Hwy 50/);
  assert.equal((payload.raw as Record<string, string>).city_id, "default");
  // Date header preserved as started_at
  assert.equal(String(payload.started_at).startsWith("2026-07-18"), true);

  assert.deepEqual(modifyCalls, ["m1"]); // marked read only after successful ingest
});

test("unknown and inactive senders are skipped, never guessed", async () => {
  const { ingestCalls, modifyCalls } = mockGmail([
    gmailMessage("m2", "Random Newsletter <spam@example.net>", "Buy things", "..."),
    gmailMessage("m3", "Old List <old@example.com>", "Stale", "..."),
  ]);
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.ingested, 0);
  assert.equal(body.unknown_sender, 2);
  assert.equal(ingestCalls.length, 0);
  // Left unread so the operator can decide whether it deserves a source row
  assert.deepEqual(modifyCalls, []);
});

test("a failed ingest leaves the message unread for retry", async () => {
  const { modifyCalls } = mockGmail(
    [gmailMessage("m4", "alerts@nixle.com", "Water main break", "Crews on scene.")],
    false
  );
  const res = await handler(makeRequest("/", { body: {} }));
  const body = await res.json();
  assert.equal(body.ingested, 0);
  assert.equal(body.errors.length, 1);
  assert.deepEqual(modifyCalls, []);
});

test("listserv boilerplate is stripped from the body", async () => {
  const { ingestCalls } = mockGmail([
    gmailMessage(
      "m5",
      "alerts@nixle.com",
      "Boil order lifted",
      "The boil order for the north side is lifted.\n\n--\nUnsubscribe here: http://example.com/u/123\nYou are receiving this because you subscribed."
    ),
  ]);
  await handler(makeRequest("/", { body: {} }));
  const sent = String(ingestCalls[0].body);
  assert.match(sent, /boil order for the north side is lifted/);
  assert.ok(!/Unsubscribe/i.test(sent), "unsubscribe boilerplate must be stripped");
  assert.ok(!/receiving this/i.test(sent));
});

test("html-only mail is de-tagged into readable text", async () => {
  const htmlOnly = {
    id: "m6",
    payload: {
      headers: [
        { name: "From", value: "alerts@nixle.com" },
        { name: "Subject", value: "Shelter open" },
        { name: "Date", value: "Sat, 18 Jul 2026 09:00:00 -0500" },
      ],
      mimeType: "text/html",
      body: { data: b64url("<html><style>p{}</style><body><p>Warming shelter open at the <b>library</b>.</p></body></html>") },
    },
  };
  const { ingestCalls } = mockGmail([htmlOnly]);
  await handler(makeRequest("/", { body: {} }));
  const sent = String(ingestCalls[0].body);
  assert.match(sent, /Warming shelter open at the library\./);
  assert.ok(!sent.includes("<"), "tags must be stripped");
});

test("audit row records the run", async () => {
  mockGmail([gmailMessage("m7", "alerts@nixle.com", "Test", "body")]);
  await handler(makeRequest("/", { body: {} }));
  assert.equal(callsFor(sharedCalls, "activity_log", "insert").length, 1);
});
