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

test("one bad slug cannot make the whole sitemap unparseable", async () => {
  // A sitemap is parsed as XML: a single raw "&" or "<" anywhere invalidates
  // the entire document, so Google drops every URL in it. Slugs come from the
  // database (shore_path_stops.slug is operator-entered and unconstrained), so
  // a single row must not be able to blank a city's sitemap.
  currentResolver = (q) => {
    if (q.table === "city_config") {
      return { data: { id: "default", site_domain: "testville.example", city_name: "Testville" } };
    }
    if (q.table === "incidents") {
      return { data: [{ slug: "fire-at-smith&sons", updated_at: "2026-07-10T00:00:00Z", status: "resolved" }] };
    }
    if (q.table === "shore_path_stops") {
      return { data: [{ slug: 'stop-<script>"', updated_at: "2026-07-10T00:00:00Z", order_index: 1 }] };
    }
    return { data: [] };
  };

  const xml = await (await handler(makeRequest("/", { method: "GET" }))).text();

  // No raw markup-significant characters survive inside a <loc>.
  for (const loc of xml.match(/<loc>[\s\S]*?<\/loc>/g) ?? []) {
    const inner = loc.slice("<loc>".length, -"</loc>".length);
    assert.ok(!/[<>]/.test(inner), `unescaped angle bracket in ${loc}`);
    assert.ok(
      !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(inner),
      `raw ampersand in ${loc} — the whole document fails to parse`
    );
  }
  assert.match(xml, /<loc>https:\/\/testville\.example\/incidents\/fire-at-smith&amp;sons<\/loc>/);
});

test("a gated incident is never submitted to Google, because its slug leaks the title", async () => {
  // Every URL in a sitemap is submitted to a search engine. incidents.slug is
  // computed upstream as slugify(RAW title), so an ungated row publishes the
  // name and house number the redactor exists to remove — in the sitemap
  // itself, without any page ever rendering it. serve-page also 404s these
  // rows, so listing them submits soft-404s too.
  currentResolver = (q) => {
    if (q.table === "city_config") {
      return { data: { id: "default", site_domain: "testville.example", city_name: "Testville" } };
    }
    if (q.table === "incidents") {
      return {
        data: [
          // Tier 4 ("arrested") — must never be listed.
          {
            slug: "deputy-jane-halloran-arrested-a-man-at-1247-w-main-street",
            title: "Deputy Jane Halloran arrested a man at 1247 W Main Street",
            status: "resolved",
            updated_at: "2026-07-10T00:00:00Z",
          },
          // Tier 3 in the BODY only — the title looks clean, the row is not.
          {
            slug: "incident-on-elm",
            title: "Incident on Elm",
            body: "Deputies reported shots fired near the park.",
            status: "active",
            updated_at: "2026-07-10T00:00:00Z",
          },
          // Clears both tiers, but the title carries a personal detail, so the
          // slug spells out the address. Fail closed.
          {
            slug: "water-main-break-at-1247-w-main-street",
            title: "Water main break at 1247 W Main Street",
            status: "active",
            updated_at: "2026-07-10T00:00:00Z",
          },
          // Clean row — still published.
          {
            slug: "crash-hwy-50",
            title: "Crash reported on Highway 50",
            status: "resolved",
            updated_at: "2026-07-10T00:00:00Z",
          },
        ],
      };
    }
    return { data: [] };
  };

  const xml = await (await handler(makeRequest("/", { method: "GET" }))).text();

  assert.ok(!xml.includes("halloran"), "a Tier-4 row's slug must not be submitted");
  assert.ok(!xml.includes("incident-on-elm"), "a row gated on its body must not be submitted");
  assert.ok(!xml.includes("1247"), "an exact street number must never appear in a sitemap");
  assert.match(xml, /https:\/\/testville\.example\/incidents\/crash-hwy-50/);
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
