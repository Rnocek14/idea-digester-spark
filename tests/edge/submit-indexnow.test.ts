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

await importBundle("submit-indexnow");
const handler = deno.handler();

/** Capture what would be POSTed to IndexNow instead of hitting the network. */
type Posted = { url: string; body: Record<string, unknown> };
let posted: Posted[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  sharedCalls.length = 0;
  posted = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("indexnow")) {
      posted.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response("", { status: 200 });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
});

const CITY = {
  id: "default",
  city_name: "Testville",
  state_code: "WI",
  site_domain: "testville.example",
  site_name: "Testville Brief",
  status: "active",
};

function baseResolver(incidents: Record<string, unknown>[], stories: Record<string, unknown>[] = []): Resolver {
  return (q) => {
    if (q.table === "city_config") return { data: [CITY] };
    if (q.table === "content_queue") return { data: stories };
    if (q.table === "incidents") return { data: incidents };
    return undefined;
  };
}

test("submits changed URLs on the city's own domain, with the key location on that host", async () => {
  currentResolver = baseResolver(
    [{ slug: "water-main-break-20260729", title: "Water main break closes a lane", incident_type: "utility", updated_at: "2026-07-29T00:00:00Z" }],
    [{ id: "s1", title: "Council approves budget", updated_at: "2026-07-29T00:00:00Z" }],
  );

  const res = await handler(makeRequest("http://localhost/submit-indexnow?hours=24"));
  assert.equal(res.status, 200);

  assert.equal(posted.length, 1, "expected exactly one IndexNow submission");
  const body = posted[0].body as { host: string; key: string; keyLocation: string; urlList: string[] };

  assert.equal(body.host, "testville.example");
  assert.ok(
    body.keyLocation.startsWith("https://testville.example/"),
    `keyLocation must live on the submitted host, got ${body.keyLocation}`,
  );
  assert.ok(body.keyLocation.endsWith(`${body.key}.txt`), "keyLocation must be the key file");

  // Every URL must be absolute and on this city's domain — never the template city's.
  for (const u of body.urlList) {
    assert.ok(u.startsWith("https://testville.example/"), `wrong host in submitted URL: ${u}`);
  }
  assert.ok(body.urlList.some((u) => u.includes("/stories/s1")));
  assert.ok(body.urlList.some((u) => u.includes("/incidents/water-main-break-20260729")));
  assert.ok(!JSON.stringify(body).includes("lakegenevabrief.com"), "leaked the template city's domain");
});

// The exact bug that was found in serve-sitemap: the slug is built from the raw title,
// so an ungated incident publishes a name in the payload even though no page renders it.
test("gated incidents are never submitted", async () => {
  currentResolver = baseResolver([
    { slug: "john-smith-taken-into-custody-20260729", title: "John Smith was taken into custody", incident_type: "police", updated_at: "2026-07-29T00:00:00Z" },
    { slug: "tree-down-on-a-sidewalk-20260729", title: "Tree down across a sidewalk", incident_type: "weather", updated_at: "2026-07-29T00:00:00Z" },
  ]);

  const res = await handler(makeRequest("http://localhost/submit-indexnow?hours=24"));
  assert.equal(res.status, 200);

  const payload = JSON.stringify(posted[0]?.body ?? {});
  assert.ok(!/john-smith|custody/i.test(payload), `gated incident leaked into submission: ${payload}`);
  assert.ok(/tree-down/.test(payload), "routine incident should still be submitted");
});

test("dry run collects URLs but posts nothing", async () => {
  currentResolver = baseResolver([], [{ id: "s1", title: "A story", updated_at: "2026-07-29T00:00:00Z" }]);

  const res = await handler(makeRequest("http://localhost/submit-indexnow?dry=1"));
  const json = await res.json();

  assert.equal(posted.length, 0, "dry run must not POST");
  assert.equal(json.dry_run, true);
  assert.ok(json.results[0].urls >= 1, "dry run should still report what it would send");
});

test("nothing new means nothing is submitted", async () => {
  // Re-pinging an unchanged URL set is how a site teaches a crawler to ignore it.
  currentResolver = baseResolver([], []);
  const res = await handler(makeRequest("http://localhost/submit-indexnow?hours=1"));
  const json = await res.json();

  assert.equal(posted.length, 0);
  assert.equal(json.results[0].urls, 0);
});

test("a city with no domain is skipped without throwing", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: [{ ...CITY, site_domain: null }] };
    if (q.table === "content_queue") return { data: [{ id: "s1", title: "x", updated_at: "2026-07-29T00:00:00Z" }] };
    if (q.table === "incidents") return { data: [] };
    return undefined;
  };

  const res = await handler(makeRequest("http://localhost/submit-indexnow"));
  assert.equal(res.status, 200, "one bad city must not fail the fleet run");
  const json = await res.json();
  assert.equal(json.results[0].submitted, false);
});
