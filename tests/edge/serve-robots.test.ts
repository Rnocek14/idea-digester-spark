// serve-robots — the fleet-safety guarantees, not the formatting.
//
// The failure this file exists to prevent: one static robots.txt in a shared
// dist/, served on every city domain, telling city #2's crawlers to fetch city
// #1's sitemap and treating city #1's hostname as canonical for everyone.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  installDeno,
  createMockSupabase,
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

await importBundle("serve-robots");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

// --- fixtures --------------------------------------------------------------

const TEMPLATE_CITY = {
  id: "default",
  city_name: "Lake Geneva",
  state_code: "WI",
  county_name: "Walworth County",
  site_domain: "template-city.example",
  site_name: "Template City Brief",
  hostname: "template-city.example",
};

const SECOND_CITY = {
  id: "testville",
  city_name: "Testville",
  state_code: "ZZ",
  county_name: "Test County",
  site_domain: "testville.example",
  site_name: "Testville Brief",
  hostname: "testville.example",
};

/** Serve city rows the way the real table would: by id, hostname or domain. */
function cityResolver(rows: Array<Record<string, unknown>>): Resolver {
  return (q) => {
    if (q.table !== "city_config") return {};
    const eq = (col: string) => q.filters.find((f) => f.m === "eq" && f.args[0] === col)?.args[1];
    const byId = eq("id");
    if (byId !== undefined) {
      return { data: rows.find((r) => r.id === byId) ?? null };
    }
    const host = eq("hostname") ?? eq("site_domain");
    if (host !== undefined) {
      return { data: rows.find((r) => r.hostname === host || r.site_domain === host) ?? null };
    }
    return { data: null };
  };
}

function robotsRequest(opts: { host?: string; cityId?: string } = {}): Request {
  const qs = opts.cityId ? `?city_id=${encodeURIComponent(opts.cityId)}` : "";
  return new Request(`http://edge.test/serve-robots${qs}`, {
    method: "GET",
    headers: opts.host ? { host: opts.host } : {},
  });
}

function sitemapLines(body: string): string[] {
  return body
    .split("\n")
    .filter((l) => l.trim().toLowerCase().startsWith("sitemap:"))
    .map((l) => l.trim());
}

// --- the guarantees --------------------------------------------------------

test("the sitemap URL carries the resolved city's id", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const res = await handler(robotsRequest({ host: "testville.example" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /text\/plain/);

  const body = await res.text();
  const lines = sitemapLines(body);
  assert.ok(lines.length > 0, "must advertise a sitemap");
  assert.ok(
    lines.some((l) => l.includes("serve-sitemap?city_id=testville")),
    `expected the resolved city's id in the sitemap URL, got:\n${lines.join("\n")}`
  );
  // Never the other city's id — that is the whole bug.
  assert.ok(!body.includes("city_id=default"), "must not point at another city's sitemap");
});

test("?city_id= resolves the city even when the Host header says otherwise", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const body = await (await handler(robotsRequest({ host: "template-city.example", cityId: "testville" }))).text();
  assert.ok(sitemapLines(body).some((l) => l.includes("city_id=testville")));
});

test("a non-default host never emits the template city's domain or name", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const body = await (await handler(robotsRequest({ host: "testville.example" }))).text();

  assert.ok(!body.includes("lakegenevabrief.com"), "must not name the original brand domain");
  assert.ok(!body.includes("template-city.example"), "must not leak the template city's domain");
  assert.ok(!body.includes("Lake Geneva"), "must not leak the template city's name");
  // The build-time /sitemap.xml in the shared dist/ describes the template city
  // only, so a second city must not advertise it on its own domain.
  assert.ok(
    !sitemapLines(body).some((l) => l.endsWith("/sitemap.xml")),
    "a non-template city must not advertise the shared build-time sitemap"
  );
  // No canonical claim on anyone's behalf.
  assert.ok(!/canonical/i.test(body), "robots.txt must make no canonical-host claim");
});

test("the template city still gets both its live and build-time sitemaps", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const body = await (await handler(robotsRequest({ host: "template-city.example" }))).text();
  const lines = sitemapLines(body);
  assert.ok(lines.some((l) => l.includes("serve-sitemap?city_id=default")));
  assert.ok(lines.some((l) => l === "Sitemap: https://template-city.example/sitemap.xml"));
});

test("an unknown host falls back to the default row rather than guessing", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const body = await (await handler(robotsRequest({ host: "not-a-city.example" }))).text();
  assert.ok(sitemapLines(body).some((l) => l.includes("city_id=default")));
  assert.ok(!body.includes("not-a-city.example"));
});

test("a hard failure still returns a permissive 200 (5xx reads as crawl-nothing)", async () => {
  // Simulate the client itself failing to construct — the one path that can
  // still throw, since resolveCityConfig swallows query errors on its own.
  const realFactory = (globalThis as Record<string, unknown>).__createMockSupabase;
  (globalThis as Record<string, unknown>).__createMockSupabase = () => {
    throw new Error("supabase unreachable");
  };
  try {
    const res = await handler(robotsRequest({ host: "testville.example" }));
    assert.equal(res.status, 200, "robots.txt must never 5xx — Google reads that as Disallow: /");
    const body = await res.text();
    assert.match(body, /User-agent: \*/);
    assert.match(body, /^Allow: \/$/m);
    assert.equal(sitemapLines(body).length, 0, "cannot name a sitemap for an unresolved city");
  } finally {
    (globalThis as Record<string, unknown>).__createMockSupabase = realFactory;
  }
});

test("private surfaces are disallowed in every named group, not just the wildcard", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const body = await (await handler(robotsRequest({ host: "testville.example" }))).text();
  // A named user-agent group replaces the wildcard group; a Disallow written
  // only under `*` would not apply to Googlebot at all.
  const groups = body.split(/\n\s*\n/).filter((b) => b.includes("User-agent:"));
  assert.ok(groups.length >= 5, "expected explicit groups for the major crawlers");
  for (const agent of ["Googlebot", "GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot"]) {
    const group = groups.find((g) => g.includes(`User-agent: ${agent}`));
    assert.ok(group, `${agent} must have its own group`);
    assert.ok(group!.includes("Allow: /"), `${agent} must be allowed`);
    assert.ok(group!.includes("Disallow: /dashboard"), `${agent} group must exclude the dashboard`);
  }
});

test("a newline in a city_config value cannot inject a robots directive", async () => {
  // site_name and site_domain are free text typed into the Add-City admin
  // form. robots.txt is line-oriented, so an embedded newline used to end the
  // header comment and start a REAL directive — "Foo\nDisallow: /" published
  // a site-wide Disallow on that city's domain.
  currentResolver = cityResolver([
    TEMPLATE_CITY,
    {
      ...SECOND_CITY,
      site_name: "Testville\nDisallow: /",
      site_domain: "testville.example\nDisallow: /",
    },
  ]);

  const body = await (await handler(robotsRequest({ host: "testville.example" }))).text();

  // Every Disallow in the document must be one of ours, in a group.
  const disallows = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith("disallow:"));
  const allowed = new Set([
    "Disallow: /dashboard",
    "Disallow: /employer-dashboard",
    "Disallow: /sponsor-portal",
    "Disallow: /auth",
    "Disallow: /debug/",
  ]);
  for (const d of disallows) {
    assert.ok(allowed.has(d), `injected directive reached robots.txt: ${JSON.stringify(d)}`);
  }
  // And the comment stays a comment: no line may start a directive mid-value.
  assert.ok(
    !/^Disallow: \/$/m.test(body),
    "a site-wide Disallow: / must never appear"
  );
});

test("caching is host-aware so a shared cache cannot cross-serve cities", async () => {
  currentResolver = cityResolver([TEMPLATE_CITY, SECOND_CITY]);

  const res = await handler(robotsRequest({ host: "testville.example" }));
  const vary = res.headers.get("Vary") ?? "";
  assert.match(
    vary,
    /host/i,
    "robots.txt is publicly cacheable and host-dependent; without Vary a cache may serve another city's Sitemap line"
  );
});

// --- the static fallback ---------------------------------------------------

test("public/robots.txt is safe on any hostname", () => {
  const path = fileURLToPath(new URL("../../public/robots.txt", import.meta.url));
  const body = readFileSync(path, "utf8");

  // A Sitemap: directive requires an absolute URL, and an absolute URL is
  // city-specific — so in a file served on every city's domain there should be
  // none. ONE deliberate exception is currently permitted: while exactly one
  // city exists and the serve-robots hosting rewrite is not wired, the single
  // live domain carries its own sitemap line, and the file must say so with a
  // removal marker. This assertion allows precisely that marked exception and
  // nothing else — when city #2 launches, deleting the marker (as the file
  // instructs) makes any remaining absolute sitemap line fail this test again.
  const lines = sitemapLines(body);
  if (lines.length > 0) {
    assert.equal(lines.length, 1, "at most the one marked single-city sitemap line");
    assert.ok(
      body.includes("REMOVE BEFORE LAUNCHING CITY #2"),
      "an absolute sitemap line is only permitted alongside its removal marker"
    );
  }
  assert.ok(!body.includes("supabase.co"), "fallback must not hardcode a project ref");
  assert.ok(
    !/^#\s*Canonical host/im.test(body),
    "fallback must not claim a canonical host it is not always served on"
  );
  // Still a working robots.txt.
  assert.match(body, /User-agent: \*/);
  assert.match(body, /^Allow: \/$/m);
  assert.match(body, /serve-robots/, "must point an operator at the per-city function");
});

// POLICY CHANGE (2026-08-19): public/llms.txt is no longer a hostname-neutral
// stub. The hosting rewrite that would serve the per-city function still does
// not exist, so scripts/generate-edge-fallbacks.ts snapshots the DEPLOYED
// serve-llms output into this file at every build — the same single-city
// pragmatism the robots.txt sitemap line already carries, and the same
// trade-off: correct while exactly one city exists, replaced by real rewrites
// before city #2. These tests guard the NEW contract: the snapshot must look
// like real serve-llms output, and the generator must carry the single-city
// marker so the city-#2 grep finds it.
test("public/llms.txt is a real serve-llms snapshot", () => {
  const path = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
  const body = readFileSync(path, "utf8");

  assert.match(body, /^# .+/m, "snapshot starts with an llms.txt title heading");
  assert.match(body, /^> .+/m, "snapshot carries the summary blockquote");
  assert.ok(body.length > 300, "snapshot is real content, not an error body");
});

test("public/feed.xml is a real serve-feed snapshot", () => {
  const path = fileURLToPath(new URL("../../public/feed.xml", import.meta.url));
  const body = readFileSync(path, "utf8");

  assert.match(body, /<feed[\s>]/, "snapshot is an Atom feed");
  assert.match(body, /<entry>/, "snapshot carries at least one entry");
});

test("the fallback generator carries the single-city removal marker", () => {
  const path = fileURLToPath(
    new URL("../../scripts/generate-edge-fallbacks.ts", import.meta.url),
  );
  const body = readFileSync(path, "utf8");
  assert.ok(
    body.includes("SINGLE-CITY PRAGMATISM"),
    "generate-edge-fallbacks.ts must carry the marker that the city-#2 launch checklist greps for",
  );
});
