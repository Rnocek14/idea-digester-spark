import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  installDeno,
  createMockSupabase,
  makeRequest,
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

await importBundle("serve-sitemap");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

function contentQueueKind(q: QueryCall): "events" | "stories" | null {
  if (q.table !== "content_queue") return null;
  if (q.filters.some((f) => f.m === "eq" && f.args[0] === "category" && f.args[1] === "events")) return "events";
  if (q.filters.some((f) => f.m === "gte" && f.args[0] === "publish_date")) return "stories";
  return null;
}

test("sitemap is generated from the DB with the configured domain", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") {
      return { data: { id: "default", site_domain: "testville.example", city_name: "Testville" } };
    }
    if (contentQueueKind(q) === "events") {
      return { data: [{ id: "e1", event_date: "2099-01-01", updated_at: "2026-07-01T00:00:00Z" }] };
    }
    if (contentQueueKind(q) === "stories") {
      return { data: [{ id: "s1", title: "Big News In Testville!", updated_at: "2026-07-11T00:00:00Z", publish_date: "2026-07-10" }] };
    }
    if (q.table === "incidents") {
      return { data: [{ slug: "crash-hwy-50", updated_at: "2026-07-10T00:00:00Z", status: "resolved" }] };
    }
    if (q.table === "shore_path_stops") return { data: [] };
    return {};
  };

  const res = await handler(makeRequest("/", { method: "GET" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /application\/xml/);
  assert.match(res.headers.get("Cache-Control") ?? "", /max-age=3600/);

  const xml = await res.text();
  // Configured domain everywhere, never the hardcoded brand
  assert.match(xml, /<loc>https:\/\/testville\.example\/<\/loc>/);
  assert.ok(!xml.includes("lakegenevabrief.com"), "must use city_config domain");
  // Dynamic entries present
  assert.match(xml, /https:\/\/testville\.example\/events\/e1/);
  assert.match(xml, /https:\/\/testville\.example\/incidents\/crash-hwy-50/);
  assert.match(xml, /https:\/\/testville\.example\/stories\/big-news-in-testville-s1/);
  // Static entries present
  assert.match(xml, /https:\/\/testville\.example\/guides<\/loc>|https:\/\/testville\.example\/guides\b/);
  // Valid XML shell
  assert.ok(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`));
  assert.ok(xml.trimEnd().endsWith("</urlset>"));
});

test("story/event queries request only publicly-visible content (matches anon RLS)", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: { id: "default", site_domain: "x.example" } };
    const kind = contentQueueKind(q);
    if (kind) {
      const safety = q.filters.find((f) => f.m === "eq" && f.args[0] === "safety_level");
      assert.equal(safety?.args[1], "safe", `${kind} query must be safe-only`);
      const status = q.filters.find((f) => f.m === "in" && f.args[0] === "status");
      assert.deepEqual(
        [...(status!.args[1] as string[])].sort(),
        ["auto_published", "published"],
        `${kind} status filter must match RLS`
      );
      return { data: [] };
    }
    return { data: [] };
  };
  const res = await handler(makeRequest("/", { method: "GET" }));
  assert.equal(res.status, 200);
});
