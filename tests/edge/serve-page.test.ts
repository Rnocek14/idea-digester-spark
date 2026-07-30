import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
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

await importBundle("serve-page");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
});

// --- helpers ---------------------------------------------------------------

const TESTVILLE = {
  id: "testville",
  city_name: "Testville",
  state_code: "ZZ",
  county_name: "Test County",
  timezone: "America/Chicago",
  site_domain: "testville.example",
  site_name: "Testville Brief",
  hostname: "testville.example",
};

/** GET the function the way a CDN rewrite would: ?path=<site path>. */
function pageRequest(
  path: string,
  opts: { host?: string; cityId?: string; query?: string } = {}
): Request {
  const params = new URLSearchParams();
  params.set("path", path);
  if (opts.cityId) params.set("city_id", opts.cityId);
  if (opts.query) {
    for (const [k, v] of new URLSearchParams(opts.query)) params.set(k, v);
  }
  return new Request(`http://edge.test/serve-page?${params.toString()}`, {
    method: "GET",
    headers: opts.host ? { host: opts.host } : {},
  });
}

function cityRowFor(q: QueryCall): unknown | undefined {
  if (q.table !== "city_config") return undefined;
  const eq = (col: string) => q.filters.find((f) => f.m === "eq" && f.args[0] === col)?.args[1];
  // The default-row lookup deliberately misses so the built-in Lake Geneva
  // defaults are the fallback: if per-city override ever stops working, the
  // brand string leaks into the HTML and the assertions below catch it.
  if (eq("id") === "default") return { data: null };
  if (eq("hostname") === TESTVILLE.hostname) return { data: TESTVILLE };
  if (eq("id") === TESTVILLE.id) return { data: TESTVILLE };
  return { data: null };
}

function countOccurrences(haystack: string, needle: RegExp): number {
  return (haystack.match(needle) ?? []).length;
}

const INCIDENT_ROW = {
  id: "inc-1",
  slug: "water-main-break-main-st",
  title: `Water main break: 5 < 10 & "big" it's`,
  incident_type: "utility",
  sub_type: "water_main",
  status: "monitoring",
  location: "123 Main St",
  started_at: "2026-07-20T14:30:00Z",
  updated_at: "2026-07-20T18:00:00Z",
  resolved_at: null,
  ai_rewrite: "Crews closed 123 Main St after a water main failed. Call 262-555-0148 for details.",
  body: null,
  source: "community",
  source_type: "community",
};

// Trips the Tier-4 gate ("arrest"). Must never reach a public surface.
const GATED_ROW = {
  id: "inc-2",
  slug: "downtown-arrest",
  title: "Officer arrested a man outside 412 Elm St",
  incident_type: "police",
  sub_type: "arrest",
  status: "resolved",
  location: "412 Elm St",
  started_at: "2026-07-19T02:00:00Z",
  updated_at: "2026-07-19T05:00:00Z",
  resolved_at: "2026-07-19T05:00:00Z",
  ai_rewrite: "A man was arrested after a disturbance.",
  body: null,
  source: "spotcrime",
  source_type: "spotcrime",
};

// --- city resolution -------------------------------------------------------

test("resolves the city from the Host header and builds every URL from it", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [INCIDENT_ROW] };
    return { data: [] };
  };

  const res = await handler(pageRequest("/incidents", { host: "www.testville.example" }));
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<link rel="canonical" href="https:\/\/testville\.example\/incidents">/);
  assert.match(html, /Testville Brief/);
  assert.ok(
    !html.includes("lakegenevabrief.com"),
    "a non-default city must never emit the default brand domain"
  );
  assert.ok(!html.includes("Lake Geneva"), "a non-default city must never emit the default city name");
});

test("?city_id= wins over the Host header", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [] };
    return { data: [] };
  };

  const res = await handler(
    pageRequest("/incidents", { host: "some-other-host.example", cityId: "testville" })
  );
  const html = await res.text();
  assert.match(html, /https:\/\/testville\.example\/incidents/);

  const cityQuery = sharedCalls.find(
    (c) => c.table === "incidents" && c.filters.some((f) => f.m === "eq" && f.args[0] === "city_id")
  );
  assert.equal(
    cityQuery?.filters.find((f) => f.m === "eq" && f.args[0] === "city_id")?.args[1],
    "testville",
    "content must be scoped to the resolved city"
  );
});

// --- head correctness ------------------------------------------------------

test("head has exactly one of each social tag and a feed alternate", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: INCIDENT_ROW };
    return { data: [] };
  };

  const res = await handler(
    pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" })
  );
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.equal(countOccurrences(html, /<meta property="og:title"/g), 1);
  assert.equal(countOccurrences(html, /<meta property="og:description"/g), 1);
  assert.equal(countOccurrences(html, /<meta property="og:url"/g), 1);
  assert.equal(countOccurrences(html, /<meta property="og:type"/g), 1);
  assert.equal(countOccurrences(html, /<meta name="twitter:card"/g), 1);
  assert.equal(countOccurrences(html, /<link rel="canonical"/g), 1);
  assert.equal(countOccurrences(html, /<title>/g), 1);
  assert.equal(countOccurrences(html, /<meta name="description"/g), 1);

  assert.match(
    html,
    /<link rel="alternate" type="application\/atom\+xml" title="[^"]*" href="https:\/\/testville\.example\/feed\.xml">/
  );
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/testville\.example\/incidents\/water-main-break-main-st">/
  );
});

test("crawler-readable: no script tags other than JSON-LD, no external stylesheet", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: INCIDENT_ROW };
    return { data: [] };
  };

  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();

  const scripts = html.match(/<script[^>]*>/g) ?? [];
  assert.ok(scripts.length > 0, "JSON-LD should be present");
  for (const tag of scripts) {
    assert.match(tag, /type="application\/ld\+json"/, `unexpected executable script: ${tag}`);
  }
  assert.ok(!/<link[^>]+rel="stylesheet"/.test(html), "no external stylesheet");
  assert.match(html, /<style>/, "CSS must be inline");
  // A human landing on the crawler page can still reach the real site.
  assert.match(html, /class="spa-link" href="https:\/\/testville\.example\//);
});

// --- escaping --------------------------------------------------------------

test("escapes interpolated text in both text nodes and attribute values", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: INCIDENT_ROW };
    return { data: [] };
  };

  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();

  // Text node (<h1> and <title>)
  assert.match(html, /Water main break: 5 &lt; 10 &amp; &quot;big&quot; it&#39;s/);
  // Attribute context (og:title) — the raw quote must not close the attribute.
  assert.match(
    html,
    /<meta property="og:title" content="Water main break: 5 &lt; 10 &amp; &quot;big&quot; it&#39;s[^"]*">/
  );
  // No raw angle bracket or bare quote from the title survived anywhere.
  assert.ok(!html.includes(`5 < 10`), "raw < from data must not appear");
  assert.ok(!html.includes(`&"big"`), "raw quotes from data must not appear");
});

test("JSON-LD cannot break out of its script element", async () => {
  // Two shapes: a well-formed tag (stripped before render) and a lone angle
  // bracket (survives stripping, so JSON-LD must unicode-escape it).
  const nasty = {
    ...INCIDENT_ROW,
    title: "Detour </script><img src=x> posted < 2 miles",
  };
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: nasty };
    return { data: [] };
  };

  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();

  assert.ok(!html.includes("</script><img"), "markup in data must never render as markup");
  assert.match(html, /"headline":"Detour posted \\u003c 2 miles"/);
  const scripts = html.match(/<script[^>]*>/g) ?? [];
  assert.equal(scripts.length, 2);
  for (const tag of scripts) assert.match(tag, /type="application\/ld\+json"/);
});

// --- privacy gate ----------------------------------------------------------

test("a gated (Tier-4) incident 404s on its detail route", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: GATED_ROW };
    return { data: [] };
  };

  const res = await handler(pageRequest("/incidents/downtown-arrest", { host: "testville.example" }));
  assert.equal(res.status, 404, "a gated row must be indistinguishable from a missing row");
  const html = await res.text();
  assert.match(res.headers.get("Content-Type") ?? "", /text\/html/);
  assert.match(html, /<h1>/, "404 must be a real HTML page, not an empty body");
  assert.ok(!html.includes("arrested"), "gated text must not leak into the 404 page");
  assert.ok(!html.includes("412 Elm"), "gated address must not leak");
});

test("a gated incident is omitted from the index while clean rows are kept", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [INCIDENT_ROW, GATED_ROW] };
    return { data: [] };
  };

  const html = await (await handler(pageRequest("/incidents", { host: "testville.example" }))).text();

  assert.match(html, /water-main-break-main-st/);
  assert.ok(!html.includes("downtown-arrest"), "gated slug must not be linked");
  assert.ok(!html.includes("arrested"), "gated title must not appear");
  assert.match(html, /1 incident on the current record/);
});

test("personal detail is redacted from text that clears the gate", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: INCIDENT_ROW };
    if (q.table === "incident_updates") {
      return {
        data: [
          {
            id: "u1",
            created_at: "2026-07-20T16:00:00Z",
            source: "community",
            source_label: "Reader report",
            is_verified: false,
            text: "Officer Daniels said the 34-year-old resident at 412 Elm St reported it.",
          },
        ],
      };
    }
    return { data: [] };
  };

  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();

  // Exact street numbers become block references.
  assert.ok(!html.includes("123 Main St"), "exact street number must not be published");
  assert.match(html, /the 100 block of Main St/);
  assert.ok(!html.includes("412 Elm St"), "exact street number in an update must be redacted");
  assert.match(html, /the 400 block of Elm St/);
  // Ages, names behind a title, and phone numbers.
  assert.ok(!html.includes("34-year-old"), "age must be withheld");
  assert.ok(!html.includes("Daniels"), "a name behind a rank must be withheld");
  assert.ok(!html.includes("262-555-0148"), "phone number must be withheld");
});

test("an update that trips the gate is dropped without suppressing the incident", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: INCIDENT_ROW };
    if (q.table === "incident_updates") {
      return {
        data: [
          { id: "u1", created_at: "2026-07-20T16:00:00Z", source: "community", source_label: "Reader report", is_verified: true, text: "Crews expect the street to reopen tonight." },
          { id: "u2", created_at: "2026-07-20T17:00:00Z", source: "spotcrime", source_label: "SpotCrime", is_verified: false, text: "A juvenile was involved in a separate matter nearby." },
        ],
      };
    }
    return { data: [] };
  };

  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();

  assert.equal(res200(html), true);
  assert.match(html, /reopen tonight/);
  assert.ok(!html.includes("juvenile"), "a Tier-4 update must be dropped");
});

function res200(html: string): boolean {
  return html.includes("<h1>");
}

// --- column hygiene --------------------------------------------------------

test("never selects * on incidents and never asks for internal columns", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [INCIDENT_ROW] };
    return { data: [] };
  };

  await handler(pageRequest("/incidents", { host: "testville.example" }));
  const incidentQueries = sharedCalls.filter((c) => c.table === "incidents");
  assert.ok(incidentQueries.length > 0);
  for (const q of incidentQueries) {
    assert.notEqual(q.selectCols, "*", "select(*) leaks internal incident columns");
    assert.ok(!/hold_reason|original_body|confidence_score/.test(q.selectCols ?? ""));
  }
});

// --- 404 -------------------------------------------------------------------

test("unknown incident slug returns a real 404 page", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) return { data: null };
    return { data: [] };
  };

  const res = await handler(pageRequest("/incidents/no-such-thing", { host: "testville.example" }));
  assert.equal(res.status, 404);
  assert.match(res.headers.get("Content-Type") ?? "", /text\/html; charset=utf-8/);
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/testville\.example\//);
  assert.ok(!html.includes("lakegenevabrief.com"));
});

test("an unknown route returns 404 rather than an empty page", async () => {
  currentResolver = (q) => (cityRowFor(q) as never) ?? { data: [] };
  const res = await handler(pageRequest("/does/not/exist", { host: "testville.example" }));
  assert.equal(res.status, 404);
  assert.match(await res.text(), /<h1>/);
});

test("a database error never leaks into the response", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") {
      return { data: null, error: { message: 'relation "incidents" does not exist' } };
    }
    return { data: [] };
  };

  const res = await handler(pageRequest("/incidents", { host: "testville.example" }));
  assert.equal(res.status, 500);
  const html = await res.text();
  assert.ok(!html.includes("relation"), "Postgres error text must not reach the reader");
  assert.match(html, /<h1>/);
});

// --- stories ---------------------------------------------------------------

const STORY_ID = "11111111-2222-3333-4444-555555555555";
const STORY_ROW = {
  id: STORY_ID,
  title: "Council approves the pier repair",
  summary: "The vote was 5-2 after two hours of public comment.",
  content: "The council approved the repair contract.\n\nWork begins after the holiday weekend.",
  category: "civic",
  image_url: null,
  original_url: "https://news.example.com/pier-repair",
  publish_date: "2026-07-25",
  created_at: "2026-07-25T12:00:00Z",
  updated_at: "2026-07-26T09:00:00Z",
  author: null,
  geo_label: "Testville",
};

test("story renders NewsArticle + BreadcrumbList, sourced and canonicalised", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "content_queue" && q.single) return { data: STORY_ROW };
    return { data: [] };
  };

  const res = await handler(
    pageRequest(`/stories/council-approves-the-pier-repair-${STORY_ID}`, {
      host: "testville.example",
    })
  );
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /"@type":"NewsArticle"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.ok(!html.includes("FAQPage"), "FAQPage was deliberately removed — do not reintroduce it");
  assert.match(
    html,
    new RegExp(
      `<link rel="canonical" href="https://testville\\.example/stories/council-approves-the-pier-repair-${STORY_ID}">`
    )
  );
  // Real text in semantic HTML with source attribution.
  assert.match(html, /<h1>Council approves the pier repair<\/h1>/);
  assert.match(html, /<time datetime="2026-07-25T00:00:00\.000Z">/);
  assert.match(html, /<p>Work begins after the holiday weekend\.<\/p>/);
  assert.match(html, /href="https:\/\/news\.example\.com\/pier-repair"[^>]*>news\.example\.com</);
  assert.ok(!html.includes("lakegenevabrief.com"));

  const storyQuery = sharedCalls.find((c) => c.table === "content_queue" && c.single);
  assert.equal(
    storyQuery?.filters.find((f) => f.m === "eq" && f.args[0] === "safety_level")?.args[1],
    "safe"
  );
  assert.deepEqual(
    [...((storyQuery?.filters.find((f) => f.m === "in" && f.args[0] === "status")?.args[1] as string[]) ?? [])].sort(),
    ["auto_published", "published"]
  );
});

test("story route without a uuid 404s instead of querying", async () => {
  currentResolver = (q) => (cityRowFor(q) as never) ?? { data: [] };
  const res = await handler(pageRequest("/stories/not-a-real-story", { host: "testville.example" }));
  assert.equal(res.status, 404);
  assert.equal(sharedCalls.filter((c) => c.table === "content_queue").length, 0);
});

// --- archive ---------------------------------------------------------------

function archiveRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    slug: `incident-${i}`,
    title: `Routine incident ${i}`,
    incident_type: "utility",
    sub_type: "outage",
    status: "resolved",
    location: `${100 + i} Oak Ave`,
    started_at: new Date(Date.UTC(2026, 5, 1) + i * 3600_000).toISOString(),
    updated_at: new Date(Date.UTC(2026, 5, 1) + i * 3600_000).toISOString(),
    resolved_at: null,
  }));
}

test("archive paginates with ?page=N and links neighbours on the resolved domain", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: archiveRows(60) };
    return { data: [] };
  };

  const page1 = await handler(pageRequest("/incidents/archive", { host: "testville.example" }));
  assert.equal(page1.status, 200);
  const html1 = await page1.text();
  assert.match(html1, /Page 1 of 2/);
  assert.equal(countOccurrences(html1, /href="https:\/\/testville\.example\/incidents\/incident-/g), 50);
  assert.match(html1, /<link rel="next" href="https:\/\/testville\.example\/incidents\/archive\?page=2">/);
  assert.ok(!html1.includes('rel="prev"'));

  const page2 = await handler(
    pageRequest("/incidents/archive", { host: "testville.example", query: "page=2" })
  );
  const html2 = await page2.text();
  assert.match(html2, /Page 2 of 2/);
  assert.match(
    html2,
    /<link rel="canonical" href="https:\/\/testville\.example\/incidents\/archive\?page=2">/
  );
  assert.equal(countOccurrences(html2, /href="https:\/\/testville\.example\/incidents\/incident-/g), 10);
  assert.match(html2, /<link rel="prev" href="https:\/\/testville\.example\/incidents\/archive">/);
  assert.ok(!html2.includes('rel="next"'));
  // Redaction still applies in the archive.
  assert.ok(!html2.includes("100 Oak Ave"));
});

test("archive page beyond the end 404s", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: archiveRows(5) };
    return { data: [] };
  };
  const res = await handler(
    pageRequest("/incidents/archive", { host: "testville.example", query: "page=9" })
  );
  assert.equal(res.status, 404);
});

// --- today -----------------------------------------------------------------

test("/today renders the published brief, recent stories and tracked incidents", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "daily_briefs") {
      return {
        data: {
          brief_date: "2026-07-30",
          body: "Quiet morning on the water.\n\nThe pier repair contract is signed.",
          is_quiet_day: false,
          updated_at: "2026-07-30T11:00:00Z",
        },
      };
    }
    if (q.table === "content_queue") return { data: [STORY_ROW] };
    if (q.table === "incidents") return { data: [INCIDENT_ROW, GATED_ROW] };
    return { data: [] };
  };

  const res = await handler(pageRequest("/today", { host: "testville.example" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /text\/html; charset=utf-8/);
  assert.match(res.headers.get("Cache-Control") ?? "", /public, max-age=300, s-maxage=600/);

  const html = await res.text();
  assert.match(html, /<h1>Today in Testville<\/h1>/);
  assert.match(html, /<p>Quiet morning on the water\.<\/p>/);
  assert.match(html, /<p>The pier repair contract is signed\.<\/p>/);
  assert.match(html, new RegExp(`/stories/council-approves-the-pier-repair-${STORY_ID}`));
  assert.match(html, /water-main-break-main-st/);
  assert.ok(!html.includes("downtown-arrest"), "gated incident must not appear on /today");
  assert.match(html, /<link rel="canonical" href="https:\/\/testville\.example\/today">/);
  assert.ok(!html.includes("lakegenevabrief.com"));

  const briefQuery = sharedCalls.find((c) => c.table === "daily_briefs");
  assert.equal(
    briefQuery?.filters.find((f) => f.m === "eq" && f.args[0] === "status")?.args[1],
    "published"
  );
  assert.equal(
    briefQuery?.filters.find((f) => f.m === "eq" && f.args[0] === "city_id")?.args[1],
    "testville"
  );
});

test("/today hedges rather than inventing when no brief has been filed", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "daily_briefs") return { data: null };
    return { data: [] };
  };

  const html = await (await handler(pageRequest("/today", { host: "testville.example" }))).text();
  assert.match(html, /brief hasn&#39;t been filed yet/);
  assert.match(html, /No stories have been filed in the last 48 hours\./);
});

// --- headers ---------------------------------------------------------------

test("200 responses carry the HTML content type and the agreed cache policy", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [INCIDENT_ROW] };
    return { data: [] };
  };
  const res = await handler(pageRequest("/incidents", { host: "testville.example" }));
  assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=300, s-maxage=600");
});

// --- regressions -----------------------------------------------------------

test("a date-only column renders the calendar date it actually holds", async () => {
  // publish_date/brief_date are Postgres `date`. Formatting them in a western
  // timezone rendered the previous day: a brief filed for the 30th captioned
  // "July 29", and a <time datetime> attribute contradicting its own label.
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "daily_briefs") {
      return {
        data: { brief_date: "2026-07-30", body: "Quiet.", is_quiet_day: false, updated_at: null },
      };
    }
    if (q.table === "content_queue") return { data: [STORY_ROW] };
    return { data: [] };
  };
  const html = await (await handler(pageRequest("/today", { host: "testville.example" }))).text();
  assert.match(html, /Written for July 30, 2026/);
  assert.ok(!html.includes("July 29, 2026"), "a date-only value must not shift a day");

  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "content_queue" && q.single) return { data: STORY_ROW };
    return { data: [] };
  };
  const story = await (
    await handler(
      pageRequest(`/stories/council-approves-the-pier-repair-${STORY_ID}`, {
        host: "testville.example",
      })
    )
  ).text();
  assert.match(story, /<time datetime="2026-07-25T00:00:00\.000Z">July 25, 2026<\/time>/);
});

test("an archive page past the end 404s even when the archive is empty", async () => {
  currentResolver = (q) => (cityRowFor(q) as never) ?? { data: [] };
  const beyond = await handler(
    pageRequest("/incidents/archive", { host: "testville.example", query: "page=99" })
  );
  assert.equal(beyond.status, 404, "an out-of-range page must not render 'Page 30 of 1'");

  const first = await handler(pageRequest("/incidents/archive", { host: "testville.example" }));
  assert.equal(first.status, 200, "an empty archive is still a real page 1");
  assert.match(
    await first.text(),
    /<link rel="canonical" href="https:\/\/testville\.example\/incidents\/archive">/
  );
});

test("the index gates on the same text the detail route gates on", async () => {
  // A clean title over a Tier-4 body: if the list query omits the body columns,
  // the index links (and the JSON-LD ItemList, and the sitemap) point at a URL
  // whose detail route 404s.
  const cleanTitleGatedBody = {
    slug: "crash-on-oak-ave",
    title: "Crash on Oak Ave",
    incident_type: "traffic",
    sub_type: "collision",
    status: "active",
    location: "300 Oak Ave",
    started_at: "2026-07-20T14:00:00Z",
    updated_at: "2026-07-20T15:00:00Z",
    resolved_at: null,
    ai_rewrite: "One person was arrested at the scene.",
    body: null,
  };
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: [cleanTitleGatedBody] };
    return { data: [] };
  };

  const html = await (await handler(pageRequest("/incidents", { host: "testville.example" }))).text();
  assert.ok(!html.includes("crash-on-oak-ave"), "must not link a row the detail route would 404");

  const listQuery = sharedCalls.find((c) => c.table === "incidents");
  assert.match(
    listQuery?.selectCols ?? "",
    /ai_rewrite/,
    "the list query must select the columns the gate reads"
  );
});

test("a malformed percent-escape in a slug is a 404, not a 500", async () => {
  currentResolver = (q) => (cityRowFor(q) as never) ?? { data: [] };
  const res = await handler(
    new Request("http://edge.test/serve-page?path=%2Fincidents%2Fbad%25zz", {
      method: "GET",
      headers: { host: "testville.example" },
    })
  );
  assert.equal(res.status, 404);
  assert.equal(sharedCalls.filter((c) => c.table === "incidents").length, 0);
});

test("a 5xx is never cached", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents") return { data: null, error: { message: "boom" } };
    return { data: [] };
  };
  const res = await handler(pageRequest("/incidents", { host: "testville.example" }));
  assert.equal(res.status, 500);
  assert.equal(
    res.headers.get("Cache-Control"),
    "no-store",
    "a CDN must not hold a transient failure"
  );
});

test("the source of record keeps the source's own casing", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city as never;
    if (q.table === "incidents" && q.single) {
      return { data: { ...INCIDENT_ROW, source: "Walworth County Sheriff", source_type: "official" } };
    }
    return { data: [] };
  };
  const html = await (
    await handler(pageRequest("/incidents/water-main-break-main-st", { host: "testville.example" }))
  ).text();
  assert.match(html, /Source of record: Walworth County Sheriff\./);
});

test("OPTIONS preflight is answered without touching the database", async () => {
  currentResolver = () => ({ data: [] });
  const res = await handler(
    new Request("http://edge.test/serve-page?path=/incidents", { method: "OPTIONS" })
  );
  assert.equal(res.status, 200);
  assert.equal(sharedCalls.length, 0);
});
