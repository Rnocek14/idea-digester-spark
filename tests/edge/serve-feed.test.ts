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

await importBundle("serve-feed");
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

const OTHERTOWN = {
  id: "othertown",
  city_name: "Othertown",
  state_code: "ZZ",
  county_name: "Test County",
  timezone: "America/Chicago",
  site_domain: "othertown.example",
  site_name: "Othertown Brief",
  hostname: "othertown.example",
};

const CITIES = [TESTVILLE, OTHERTOWN];

function feedRequest(opts: { host?: string; cityId?: string } = {}): Request {
  const params = new URLSearchParams();
  if (opts.cityId) params.set("city_id", opts.cityId);
  const qs = params.toString();
  return new Request(`http://edge.test/serve-feed${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: opts.host ? { host: opts.host } : {},
  });
}

/**
 * The default-row lookup deliberately misses so the built-in Lake Geneva
 * defaults are the fallback: if per-city resolution ever stops working, the
 * brand string leaks into the feed and the assertions below catch it.
 */
function cityRowFor(q: QueryCall): { data: unknown } | undefined {
  if (q.table !== "city_config") return undefined;
  const eq = (col: string) => q.filters.find((f) => f.m === "eq" && f.args[0] === col)?.args[1];
  if (eq("id") === "default") return { data: null };
  for (const city of CITIES) {
    if (eq("hostname") === city.hostname || eq("id") === city.id) return { data: city };
  }
  return { data: null };
}

const STORY_ID = "11111111-2222-4333-8444-555555555555";

const CLEAN_STORY = {
  id: STORY_ID,
  title: "Council & school board < weigh > a shared plan",
  summary: 'The two boards met Tuesday to discuss "shared services" for the coming year.',
  content: "Longer body text that should not be preferred over the summary.",
  category: "civic",
  author: "Staff Report",
  publish_date: "2026-07-20T15:00:00Z",
  created_at: "2026-07-20T14:00:00Z",
  updated_at: "2026-07-21T09:30:00Z",
};

function storiesResolver(rows: unknown[]): Resolver {
  return (q) => {
    const city = cityRowFor(q);
    if (city) return city;
    if (q.table === "content_queue") return { data: rows };
    return { data: [] };
  };
}

function contentQueueCall(): QueryCall | undefined {
  return sharedCalls.find((c) => c.table === "content_queue");
}

// --- tests -----------------------------------------------------------------

test("serves a valid Atom 1.0 document for the resolved city", async () => {
  currentResolver = storiesResolver([CLEAN_STORY]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /application\/atom\+xml/);
  assert.match(res.headers.get("Content-Type") ?? "", /charset=utf-8/);

  const xml = await res.text();

  // Document shell
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'), "XML declaration first");
  assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.ok(xml.trimEnd().endsWith("</feed>"));

  // Required feed-level elements
  assert.match(xml, /<id>https:\/\/testville\.example\/feed\.xml<\/id>/);
  assert.match(xml, /<title type="text">Testville Brief<\/title>/);
  assert.match(xml, /<updated>\d{4}-\d{2}-\d{2}T[\d:.]+Z<\/updated>/);
  assert.match(
    xml,
    /<link rel="self" type="application\/atom\+xml" href="https:\/\/testville\.example\/feed\.xml"\/>/
  );
  assert.match(
    xml,
    /<link rel="alternate" type="text\/html" href="https:\/\/testville\.example\/"\/>/
  );
  assert.match(xml, /<author><name>Testville Brief<\/name><uri>https:\/\/testville\.example<\/uri><\/author>/);

  // Required entry-level elements
  const entry = xml.slice(xml.indexOf("<entry>"), xml.indexOf("</entry>"));
  assert.match(entry, /<id>https:\/\/testville\.example\/stories\/11111111-2222-4333-8444-555555555555<\/id>/);
  assert.match(entry, /<title type="text">/);
  assert.match(entry, /<link rel="alternate" type="text\/html" href="https:\/\/testville\.example\/stories\/[^"]+"\/>/);
  assert.match(entry, /<updated>2026-07-21T09:30:00\.000Z<\/updated>/);
  assert.match(entry, /<published>2026-07-20T15:00:00\.000Z<\/published>/);
  assert.match(entry, /<summary type="text">/);

  // The feed's own <updated> is the newest entry timestamp, not "now".
  assert.match(xml, /<updated>2026-07-21T09:30:00\.000Z<\/updated>\n {2}<link rel="self"/);

  // Never the built-in brand
  assert.ok(!xml.includes("lakegenevabrief.com"), "must use the resolved city domain");
  assert.ok(!xml.includes("Lake Geneva"), "must not leak the default city name");
});

test("escapes ampersands and angle brackets in titles and summaries", async () => {
  currentResolver = storiesResolver([
    {
      ...CLEAN_STORY,
      title: "Fish & chips < 5 minutes from the pier",
      summary: 'A & B said "yes" <em>emphatically</em>',
    },
  ]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const xml = await res.text();

  assert.match(xml, /<title type="text">Fish &amp; chips &lt; 5 minutes from the pier<\/title>/);
  // Markup from an upstream source is stripped rather than carried through.
  assert.ok(!/<em>/.test(xml), "inline markup must be stripped or escaped");
  assert.match(xml, /A &amp; B said/);
  // A bare & anywhere would make the document ill-formed. Every ampersand must
  // begin a character or entity reference.
  const bareAmp = xml.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
  assert.equal(bareAmp, null, `unescaped ampersand in feed: ${bareAmp?.join(", ")}`);
});

test("entry ids are absolute and scoped to the requesting city", async () => {
  currentResolver = storiesResolver([CLEAN_STORY]);

  const first = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const firstXml = await first.text();

  const second = await handler(feedRequest({ host: OTHERTOWN.hostname }));
  const secondXml = await second.text();

  const idOf = (xml: string) => xml.match(/<entry>[\s\S]*?<id>([^<]+)<\/id>/)![1];

  const idA = idOf(firstXml);
  const idB = idOf(secondXml);

  assert.match(idA, /^https:\/\/testville\.example\/stories\//, "absolute, on the resolved host");
  assert.match(idB, /^https:\/\/othertown\.example\/stories\//, "absolute, on the resolved host");
  assert.notEqual(idA, idB, "the same row must not share an id across cities");

  // The id is the slug-free form so a retitled story keeps its identity.
  assert.equal(idA, `https://testville.example/stories/${STORY_ID}`);
  // ...while the link still points at the canonical slugged URL.
  assert.match(firstXml, /href="https:\/\/testville\.example\/stories\/council-school-board[^"]*"/);
});

test("?city_id= overrides the Host header", async () => {
  currentResolver = storiesResolver([CLEAN_STORY]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname, cityId: OTHERTOWN.id }));
  const xml = await res.text();

  assert.match(xml, /<id>https:\/\/othertown\.example\/feed\.xml<\/id>/);
  assert.ok(!xml.includes("testville.example"));
  assert.equal(
    contentQueueCall()?.filters.find((f) => f.m === "eq" && f.args[0] === "city_id")?.args[1],
    OTHERTOWN.id,
    "stories must be queried for the overridden city"
  );
});

test("rows tripping the editorial gate never reach the feed", async () => {
  const tier4 = {
    ...CLEAN_STORY,
    id: "aaaaaaaa-2222-4333-8444-555555555555",
    title: "Man arrested after downtown call",
    summary: "Deputies charged with theft after a report on Tuesday.",
  };
  const tier3 = {
    ...CLEAN_STORY,
    id: "bbbbbbbb-2222-4333-8444-555555555555",
    title: "Shots fired near the lakefront",
    summary: "Police responded to reports of gunfire.",
  };
  const gatedSummaryOnly = {
    ...CLEAN_STORY,
    id: "cccccccc-2222-4333-8444-555555555555",
    title: "Update from the county",
    summary: "A missing person report was filed this week.",
  };

  currentResolver = storiesResolver([CLEAN_STORY, tier4, tier3, gatedSummaryOnly]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const xml = await res.text();

  assert.equal((xml.match(/<entry>/g) ?? []).length, 1, "only the clean row survives");
  assert.ok(!xml.includes("arrested"), "Tier 4 title withheld");
  assert.ok(!xml.includes("Shots fired"), "Tier 3 title withheld");
  assert.ok(!xml.includes("missing person"), "Tier 3 summary withheld");
  assert.ok(!xml.includes(tier4.id), "gated row id must not appear");
  assert.ok(!xml.includes(tier3.id));
  assert.ok(!xml.includes(gatedSummaryOnly.id));
  assert.ok(xml.includes(STORY_ID), "clean row still published");
});

test("summaries are redacted before publication", async () => {
  currentResolver = storiesResolver([
    {
      ...CLEAN_STORY,
      title: "Sidewalk work begins downtown",
      summary: "Crews will start at 123 Main Street. Questions to clerk@example.gov or 262-555-0148.",
    },
  ]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const xml = await res.text();

  assert.ok(!xml.includes("123 Main Street"), "exact street number must become a block reference");
  assert.match(xml, /the 100 block of Main Street/);
  assert.ok(!xml.includes("clerk@example.gov"), "email address must be withheld");
  assert.ok(!xml.includes("262-555-0148"), "phone number must be withheld");
});

test("story query matches the anon RLS view of content_queue", async () => {
  currentResolver = storiesResolver([]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  assert.equal(res.status, 200);

  const call = contentQueueCall();
  assert.ok(call, "content_queue must be queried");
  assert.ok(!/\*/.test(call!.selectCols ?? ""), "never select('*') on content_queue");

  const status = call!.filters.find((f) => f.m === "in" && f.args[0] === "status");
  assert.deepEqual(
    [...(status!.args[1] as string[])].sort(),
    ["auto_published", "published"],
    "status filter must match RLS"
  );
  assert.equal(
    call!.filters.find((f) => f.m === "eq" && f.args[0] === "safety_level")?.args[1],
    "safe"
  );
  assert.equal(
    call!.filters.find((f) => f.m === "eq" && f.args[0] === "city_id")?.args[1],
    TESTVILLE.id
  );

  // An empty feed is still a valid feed — a newsreader must not get a 500 on a
  // quiet day.
  const xml = await res.text();
  assert.ok(xml.includes("</feed>"));
  assert.ok(!xml.includes("<entry>"));
  assert.match(xml, /<updated>\d{4}-\d{2}-\d{2}T/);
});

test("attribute values are escaped, not just text nodes", async () => {
  currentResolver = storiesResolver([
    {
      ...CLEAN_STORY,
      // A category lands in term="..." and an author in a text node. A bare
      // double quote in the attribute would end it early and let the rest of
      // the value be parsed as further attributes.
      category: 'civic" onload="x',
      author: 'Staff & "Friends"',
    },
  ]);

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const xml = await res.text();

  assert.ok(!/term="civic" onload=/.test(xml), "attribute must not be broken out of");
  assert.match(xml, /<category term="civic&quot; onload=&quot;x"\/>/);
  assert.match(xml, /<name>Staff &amp; &quot;Friends&quot;<\/name>/);
  const bareAmp = xml.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
  assert.equal(bareAmp, null, `unescaped ampersand in feed: ${bareAmp?.join(", ")}`);
});

test("a city row without a state code never renders a null in the subtitle", async () => {
  const noState = { ...TESTVILLE, state_code: null };
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const eq = (col: string) => q.filters.find((f) => f.m === "eq" && f.args[0] === col)?.args[1];
      if (eq("id") === "default") return { data: null };
      return { data: eq("hostname") === noState.hostname ? noState : null };
    }
    if (q.table === "content_queue") return { data: [CLEAN_STORY] };
    return { data: [] };
  };

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  const xml = await res.text();

  assert.match(xml, /<subtitle type="text">Local reporting for Testville\.<\/subtitle>/);
  assert.ok(!/null|undefined/.test(xml), "a missing column must not be rendered as a word");
});

test("a database failure returns 500 rather than a truncated document", async () => {
  currentResolver = (q) => {
    const city = cityRowFor(q);
    if (city) return city;
    if (q.table === "content_queue") return { error: { message: "connection reset" } };
    return { data: [] };
  };

  const res = await handler(feedRequest({ host: TESTVILLE.hostname }));
  assert.equal(res.status, 500);
  const body = await res.text();
  assert.ok(!body.includes("connection reset"), "never echo the database error");
  assert.ok(!body.includes("<feed"), "no half-written feed");
  // A cached 5xx turns one bad minute into hours of dead feed at the edge.
  assert.match(res.headers.get("Cache-Control") ?? "", /no-store/);
});
