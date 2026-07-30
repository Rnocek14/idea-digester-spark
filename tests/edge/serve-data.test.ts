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

await importBundle("serve-data");
const handler = deno.handler();

beforeEach(() => {
  sharedCalls.length = 0;
  currentResolver = () => undefined;
});

const CITY = {
  id: "testville",
  city_name: "Testville",
  state_code: "ZZ",
  county_name: "Test County",
  site_domain: "testville.example",
  site_name: "The Testville Brief",
  latitude: 40.1,
  longitude: -80.2,
  bbox: { minLat: 40.0, maxLat: 40.2, minLon: -80.3, maxLon: -80.1 },
  nws_zones: ["ZZZ001"],
  sheriff_press_url: "https://county.example/news-releases",
  state_511_api_base: "https://511zz.gov/api",
  utility_outage_url: "https://utility.example/outages",
};

/** Minimal valid incident row; override per test. */
function row(over: Record<string, unknown> = {}) {
  return {
    slug: "downed-tree-county-hwy-b",
    title: "Downed tree blocking County Highway B",
    incident_type: "weather",
    sub_type: "debris",
    status: "resolved",
    started_at: "2026-07-01T12:00:00Z",
    resolved_at: "2026-07-01T16:00:00Z",
    location: "County Highway B near Testville",
    source: "nws",
    body: "Crews cleared the roadway.",
    ai_rewrite: null,
    original_body: null,
    ...over,
  };
}

/** Resolver that serves city_config plus a fixed set of incident rows. */
function withRows(rows: unknown[]): Resolver {
  return (q) => {
    if (q.table === "city_config") return { data: CITY };
    if (q.table === "incidents") return { data: rows };
    return {};
  };
}

async function getJson(path: string) {
  const res = await handler(makeRequest(path, { method: "GET" }));
  const body = await res.text();
  return { res, body, json: JSON.parse(body) };
}

// ---------------------------------------------------------------------------

test("incidents.json serves provenance records for the configured city", async () => {
  currentResolver = withRows([row()]);

  const { res, json } = await getJson("/data/incidents.json");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /application\/json/);
  assert.match(res.headers.get("Access-Control-Allow-Origin") ?? "", /\*/);

  assert.equal(json.records.length, 1);
  const r = json.records[0];
  assert.deepEqual(Object.keys(r).sort(), [
    "geo_label", "incident_type", "resolved_at", "slug", "source",
    "source_name", "source_url", "started_at", "status", "title", "url",
  ]);
  assert.equal(r.source, "nws");
  assert.match(r.source_name, /National Weather Service/);
  assert.match(r.source_url, /api\.weather\.gov/);
  assert.equal(r.url, "https://testville.example/incidents/downed-tree-county-hwy-b");
  assert.equal(r.resolved_at, "2026-07-01T16:00:00Z");

  // Fleet-safety: nothing from the Lake Geneva brand leaks in.
  const raw = JSON.stringify(json);
  assert.ok(!raw.includes("lakegenevabrief.com"), "must use city_config domain");
  assert.ok(!raw.includes("Lake Geneva"), "must use city_config city name");
});

test("no counts, totals or aggregates are published anywhere", async () => {
  currentResolver = withRows([row(), row({ slug: "b", title: "Power outage reported" })]);

  const { json } = await getJson("/data/incidents.json");
  for (const banned of ["total", "count", "total_count", "record_count", "size"]) {
    assert.ok(!(banned in json), `payload must not expose "${banned}"`);
  }
  assert.equal(json.next_page, null);
  assert.match(json.notice, /DO NOT COUNT/);

  const { json: ds } = await getJson("/data/dataset.json");
  const dsRaw = JSON.stringify(ds);
  assert.ok(!/"(total|count|numberOf\w*|size)"\s*:/.test(dsRaw), "Dataset must not carry a count");
});

// --- Exclusions ------------------------------------------------------------

test("SpotCrime rows are excluded, in the query and again in code", async () => {
  currentResolver = withRows([
    row({ slug: "spot-1", title: "Theft reported downtown", source: "spotcrime" }),
    row({ slug: "spot-2", title: "Vandalism reported", source: "SpotCrime" }),
    row(),
  ]);

  const { json } = await getJson("/data/incidents.json");
  const slugs = json.records.map((r: { slug: string }) => r.slug);
  assert.deepEqual(slugs, ["downed-tree-county-hwy-b"]);

  // The DB query also refuses to pull them over the wire.
  const q = sharedCalls.find((c) => c.table === "incidents" && c.selectCols?.includes("source"));
  const notFilter = q?.filters.find((f) => f.m === "not" && f.args[0] === "source");
  assert.ok(notFilter, "incidents query must exclude spotcrime at the DB level");
  assert.match(String(notFilter!.args[2]), /spotcrime/);
});

test("rows from unregistered sources are excluded (fail-closed)", async () => {
  currentResolver = withRows([
    row({ slug: "fb-1", title: "Something a neighbour posted", source: "facebook" }),
    row({ slug: "tip-1", title: "Community tip about a smell", source: "community_tip" }),
    row({ slug: "null-1", title: "No source recorded", source: null }),
    row({ slug: "sheriff-1", title: "Road closure reported", source: "sheriff" }),
  ]);

  const { json } = await getJson("/data/incidents.json");
  assert.deepEqual(json.records.map((r: { slug: string }) => r.slug), ["sheriff-1"]);
  assert.match(json.records[0].source_name, /Test County Sheriff/);
  assert.equal(json.records[0].source_url, "https://county.example/news-releases");
});

test("tier-4 and tier-3 gated rows are excluded, including via the unpublished body", async () => {
  currentResolver = withRows([
    row({ slug: "t4-title", title: "Man arrested after traffic stop", source: "sheriff" }),
    row({ slug: "t4-body", title: "Traffic stop on the highway", source: "sheriff", body: "The driver was charged with a felony." }),
    row({ slug: "t3-title", title: "Shots fired near the lakefront", source: "sheriff" }),
    row({ slug: "t3-loc", title: "Road closure", source: "sheriff", location: "Missing person search area" }),
    row({ slug: "t4-rewrite", title: "Report from Tuesday", source: "sheriff", ai_rewrite: "A juvenile was involved." }),
    row({ slug: "clean", title: "Water main break closes a lane", source: "sheriff", body: "Crews are on scene." }),
  ]);

  const { json } = await getJson("/data/incidents.json");
  assert.deepEqual(json.records.map((r: { slug: string }) => r.slug), ["clean"]);
});

test("only publicly-visible statuses are requested and the city filter is applied", async () => {
  currentResolver = withRows([]);
  await getJson("/data/incidents.json");

  const q = sharedCalls.find((c) => c.table === "incidents" && c.selectCols?.includes("source"));
  assert.ok(q, "incidents were queried");
  const status = q!.filters.find((f) => f.m === "in" && f.args[0] === "status");
  assert.deepEqual(
    [...(status!.args[1] as string[])].sort(),
    ["active", "developing", "monitoring", "resolved"],
  );
  const city = q!.filters.find((f) => f.m === "eq" && f.args[0] === "city_id");
  assert.equal(city?.args[1], "testville");
  // The body is fetched for gating but must never be selected into output —
  // asserted by the record key set in the first test.
  assert.ok(q!.selectCols?.includes("body"));
});

// --- Redaction -------------------------------------------------------------

test("personal details are redacted from the geographic label", async () => {
  currentResolver = withRows([
    row({
      slug: "redact-1",
      // Title is clean, so the slug derived from it upstream is clean too.
      title: "Deputies responded to a report of a downed line",
      location: "1247 W Main Street, Apt 4B",
      source: "sheriff",
      body: "Routine call.",
    }),
    row({
      slug: "redact-2",
      title: "Crash reported on Highway 50",
      location: "Highway 50 at County Trunk H, call 262-555-0134",
      source: "wi511",
      body: "Lane blocked.",
    }),
  ]);

  const { json } = await getJson("/data/incidents.json");
  const [a, b] = json.records;

  assert.ok(!a.geo_label.includes("1247"), "exact street number must be removed");
  assert.match(a.geo_label, /1200 block of W Main Street/);
  assert.ok(!/4B/.test(a.geo_label), "apartment number must be removed");

  assert.ok(!b.geo_label.includes("262-555-0134"), "phone number must be removed");
  assert.match(b.geo_label, /\[phone withheld\]/);
  // Highway numbers are NOT addresses and must survive intact.
  assert.match(b.title, /Highway 50/);
  assert.match(b.geo_label, /Highway 50 at County Trunk H/);
  assert.equal(b.source, "traffic_511");
  assert.match(b.source_name, /ZZ 511/);
});

test("a row whose TITLE needs redacting is dropped, because its slug leaks it", async () => {
  // incidents.slug is computed upstream as slugify(RAW title) — see
  // ingest-incident's `slug: slugify(p.title)`. Redacting the title while
  // publishing the slug beside it, and inside the canonical url, would defeat
  // the redactor entirely. The whole record must be withheld.
  currentResolver = withRows([
    row({
      slug: "deputy-jane-halloran-responded-at-1247-w-main-street-x7f2a",
      title: "Deputy Jane Halloran responded at 1247 W Main Street",
      location: "County Highway B",
      source: "sheriff",
      body: "Routine call.",
    }),
    row({
      slug: "crash-reported-to-262-555-0134-b2c3d",
      title: "Crash reported to 262-555-0134",
      source: "wi511",
      body: "Lane blocked.",
    }),
    row({ slug: "clean-one", title: "Water main break closes a lane", source: "sheriff", body: "ok" }),
  ]);

  const { json } = await getJson("/data/incidents.json");
  assert.deepEqual(json.records.map((r: { slug: string }) => r.slug), ["clean-one"]);

  const raw = JSON.stringify(json);
  assert.ok(!/halloran/i.test(raw), "surname must not survive in the slug");
  assert.ok(!raw.includes("1247"), "house number must not survive in the slug");
  assert.ok(!raw.includes("262-555-0134"), "phone must not survive in the slug");
});

// --- CSV -------------------------------------------------------------------

test("CSV escapes commas, quotes and newlines, and neutralises formulas", async () => {
  currentResolver = withRows([
    row({
      slug: "csv-1",
      title: 'Lane closed, then reopened; crews called it "routine"',
      location: "Main St, near the bridge",
      source: "wi511",
      body: "ok",
    }),
    row({
      slug: "csv-2",
      title: "=cmd|calc",
      location: "Line one\nLine two",
      source: "nws",
      body: "ok",
    }),
    row({
      slug: "csv-3",
      title: "-2+3+cmd|calc",
      location: "somewhere",
      source: "nws",
      body: "ok",
    }),
  ]);

  const res = await handler(makeRequest("/data/incidents.csv", { method: "GET" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /text\/csv/);
  assert.match(res.headers.get("Content-Disposition") ?? "", /testville-incidents-page-1\.csv/);

  const csv = await res.text();
  const header = csv.split("\r\n")[0];
  assert.equal(
    header,
    "slug,title,incident_type,status,started_at,resolved_at,geo_label,source,source_name,source_url,url",
  );

  // Comma + embedded quotes -> wrapped and doubled.
  assert.ok(
    csv.includes('"Lane closed, then reopened; crews called it ""routine"""'),
    `quotes/commas not escaped: ${csv}`,
  );
  assert.ok(csv.includes('"Main St, near the bridge"'), "comma in geo_label not quoted");
  // Formula injection neutralised and then quoted is not required, but the
  // leading = must be gone.
  assert.ok(!/(^|,)=cmd/m.test(csv), "leading = must be neutralised");
  assert.ok(csv.includes("'=cmd|calc"), "formula prefix expected");
  // A leading minus is the other half of the DDE payload and must be
  // neutralised too.
  assert.ok(csv.includes("'-2+3+cmd"), "leading - must be neutralised");
  // Embedded newline must live inside quotes, so the row count is unchanged.
  assert.ok(csv.includes('"Line one\nLine two"'), "newline field not quoted");

  // Three data rows despite the embedded newline.
  const dataRows = csv.split("\r\n").filter(Boolean);
  assert.equal(dataRows.length, 4, `header + 3 records, got ${dataRows.length}`);
});

// --- Pagination ------------------------------------------------------------

test("pagination is bounded and translated into a DB range", async () => {
  currentResolver = withRows([]);

  await getJson("/data/incidents.json?page=3&limit=50");
  let q = sharedCalls.find((c) => c.table === "incidents" && c.selectCols?.includes("source"));
  let range = q!.filters.find((f) => f.m === "range");
  assert.deepEqual(range!.args, [100, 149], "page 3 @ 50 -> offset 100");

  // limit is clamped to 200
  sharedCalls.length = 0;
  const { json } = await getJson("/data/incidents.json?limit=100000");
  assert.equal(json.limit, 200);
  q = sharedCalls.find((c) => c.table === "incidents" && c.selectCols?.includes("source"));
  range = q!.filters.find((f) => f.m === "range");
  assert.deepEqual(range!.args, [0, 199]);

  // garbage and out-of-range input falls back to the defaults
  sharedCalls.length = 0;
  const { json: j2 } = await getJson("/data/incidents.json?page=-4&limit=abc");
  assert.equal(j2.page, 1);
  assert.equal(j2.limit, 100);
});

test("next_page is offered only while the DB window is full", async () => {
  const full = Array.from({ length: 2 }, (_, i) => row({ slug: `s${i}`, source: "nws" }));
  currentResolver = withRows(full);
  const { json } = await getJson("/data/incidents.json?limit=2");
  assert.equal(json.next_page, 2, "a full window means more pages remain");

  currentResolver = withRows([row({ slug: "only", source: "nws" })]);
  const { json: j2 } = await getJson("/data/incidents.json?limit=2");
  assert.equal(j2.next_page, null);
});

test("a page whose rows are all filtered out still reports more pages", async () => {
  // Every row is excluded, but the window was full: the consumer must keep
  // paging rather than conclude the record has ended.
  currentResolver = withRows([
    row({ slug: "x1", source: "spotcrime" }),
    row({ slug: "x2", source: "spotcrime" }),
  ]);
  const { json } = await getJson("/data/incidents.json?limit=2");
  assert.deepEqual(json.records, []);
  assert.equal(json.next_page, 2);
});

// --- Dataset description ---------------------------------------------------

test("Dataset JSON-LD states the exclusions and carries the required fields", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: CITY };
    if (q.table === "incidents") return { data: [{ started_at: "2025-12-02T00:00:00Z" }] };
    return {};
  };

  const res = await handler(makeRequest("/data/dataset.json", { method: "GET" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /application\/ld\+json/);
  const ds = JSON.parse(await res.text());

  assert.equal(ds["@type"], "Dataset");
  assert.equal(ds["@context"], "https://schema.org/");

  // The exclusions must be in `description`, where a human and a machine both
  // read them — not buried in a side field.
  const d: string = ds.description;
  assert.match(d, /DO NOT COUNT/);
  assert.match(d, /SpotCrime/);
  assert.match(d, /unverified/i);
  assert.match(d, /arrest/i);
  assert.match(d, /juvenile/i);
  assert.match(d, /missing.person/i);
  assert.match(d, /must not be published as a measure of crime or safety/i);

  // Required structured fields
  assert.equal(ds.temporalCoverage, "2025-12-02/2025-12-02");
  assert.equal(ds.spatialCoverage["@type"], "Place");
  assert.match(ds.spatialCoverage.name, /Testville, ZZ/);
  assert.ok(ds.spatialCoverage.geo.some((g: { box?: string }) => g.box === "40 -80.3 40.2 -80.1"));
  assert.equal(ds.creator.name, "The Testville Brief");
  assert.equal(ds.creator.url, "https://testville.example");
  assert.match(ds.license, /creativecommons\.org/);
  assert.ok(Array.isArray(ds.variableMeasured) && ds.variableMeasured.length > 5);
  assert.equal(ds.distribution.length, 2);
  assert.ok(ds.distribution.some((x: { contentUrl: string }) => x.contentUrl.endsWith("/data/incidents.csv")));
  assert.match(ds.creativeWorkStatus, /Incomplete/);
  assert.ok(!JSON.stringify(ds).includes("lakegenevabrief.com"));
});

// --- Fleet safety ----------------------------------------------------------

test("city is resolved from ?city_id= and from the Host header", async () => {
  const OTHER = { ...CITY, id: "otherton", city_name: "Otherton", site_domain: "otherton.example", site_name: "Otherton Brief" };

  // ?city_id= wins
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const byId = q.filters.find((f) => f.m === "eq" && f.args[0] === "id");
      if (byId?.args[1] === "otherton") return { data: OTHER };
      return { data: CITY };
    }
    return { data: [] };
  };
  const { json } = await getJson("/data/incidents.json?city_id=otherton");
  assert.equal(json.city.id, "otherton");
  assert.equal(json.attribution, "Otherton Brief (https://otherton.example)");

  // Host header lookup
  sharedCalls.length = 0;
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const byHost = q.filters.find((f) => f.m === "eq" && f.args[0] === "hostname");
      if (byHost?.args[1] === "otherton.example") return { data: OTHER };
      const byId = q.filters.find((f) => f.m === "eq" && f.args[0] === "id");
      if (byId) return { data: CITY };
      return {};
    }
    return { data: [] };
  };
  // x-forwarded-host, not host: Host is a forbidden header on a fetch Request,
  // and it is what a Supabase edge function actually sees behind the proxy.
  const j2 = await getJson2("/data/incidents.json", { "x-forwarded-host": "www.otherton.example" });
  assert.equal(j2.city.id, "otherton");
});

async function getJson2(path: string, headers: Record<string, string>) {
  const res = await handler(makeRequest(path, { method: "GET", headers }));
  return JSON.parse(await res.text());
}

test("advertised endpoint URLs echo the URL the request actually arrived on", async () => {
  currentResolver = withRows([{ started_at: "2026-01-01T00:00:00Z" }]);

  // Served directly off the Supabase functions host.
  const direct = await getJson2("/functions/v1/serve-data/dataset.json", {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "proj.supabase.co",
  });
  const urls = direct.distribution.map((d: { contentUrl: string }) => d.contentUrl);
  assert.deepEqual(urls, [
    "https://proj.supabase.co/functions/v1/serve-data/incidents.json",
    "https://proj.supabase.co/functions/v1/serve-data/incidents.csv",
  ]);

  // Served through a /data rewrite on the city's own domain.
  currentResolver = withRows([{ started_at: "2026-01-01T00:00:00Z" }]);
  const proxied = await getJson2("/data/dataset.json", {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "testville.example",
  });
  assert.deepEqual(
    proxied.distribution.map((d: { contentUrl: string }) => d.contentUrl),
    ["https://testville.example/data/incidents.json", "https://testville.example/data/incidents.csv"],
  );
  // The record's canonical page is always the site itself, never the API host.
  assert.equal(proxied.url, "https://testville.example/incidents");
});

test("advertised URLs carry ?city_id= so they resolve to the city they describe", async () => {
  const OTHER = { ...CITY, id: "otherton", city_name: "Otherton", site_domain: "otherton.example", site_name: "Otherton Brief" };
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const byId = q.filters.find((f) => f.m === "eq" && f.args[0] === "id");
      if (byId?.args[1] === "otherton") return { data: OTHER };
      return { data: CITY };
    }
    return { data: [{ started_at: "2026-01-01T00:00:00Z" }] };
  };

  // On the shared functions host the ONLY thing selecting the city is the
  // param. Dropping it from the distributions would advertise a Dataset whose
  // downloads serve a different city, and would give every city the same @id.
  const ds = await getJson2("/functions/v1/serve-data/dataset.json?city_id=otherton", {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "proj.supabase.co",
  });
  assert.deepEqual(
    ds.distribution.map((d: { contentUrl: string }) => d.contentUrl),
    [
      "https://proj.supabase.co/functions/v1/serve-data/incidents.json?city_id=otherton",
      "https://proj.supabase.co/functions/v1/serve-data/incidents.csv?city_id=otherton",
    ],
  );
  assert.equal(ds["@id"], "https://proj.supabase.co/functions/v1/serve-data/dataset.json?city_id=otherton");
  assert.equal(ds.creator.url, "https://otherton.example");

  // A bogus param falls back to the resolved city and is NOT echoed back.
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const byId = q.filters.find((f) => f.m === "eq" && f.args[0] === "id");
      if (byId?.args[1] === "nope") return {};
      return { data: CITY };
    }
    return { data: [] };
  };
  const idx = await getJson2("/data/?city_id=nope", { "x-forwarded-host": "testville.example" });
  assert.ok(!JSON.stringify(idx).includes("nope"), "unresolvable city_id must not be echoed");
  assert.match(idx.endpoints["incidents.json"], /\?city_id=testville$/);
});

test("the CSV filename cannot be broken out of by a DB-supplied city id", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") {
      const byId = q.filters.find((f) => f.m === "eq" && f.args[0] === "id");
      if (byId?.args[1] === 'ev"il; x') return { data: { ...CITY, id: 'ev"il; x' } };
      return { data: CITY };
    }
    return { data: [] };
  };
  const res = await handler(
    makeRequest(`/data/incidents.csv?city_id=${encodeURIComponent('ev"il; x')}`, { method: "GET" }),
  );
  const cd = res.headers.get("Content-Disposition") ?? "";
  assert.equal(cd, 'inline; filename="ev-il-x-incidents-page-1.csv"');
});

// --- Failure behaviour -----------------------------------------------------

test("a failed query returns 503, never an empty dataset", async () => {
  currentResolver = (q) => {
    if (q.table === "city_config") return { data: CITY };
    if (q.table === "incidents") return { error: { message: "column city_id does not exist" } };
    return {};
  };
  const res = await handler(makeRequest("/data/incidents.json", { method: "GET" }));
  assert.equal(res.status, 503);
  assert.match(res.headers.get("Cache-Control") ?? "", /no-store/);
  const body = JSON.parse(await res.text());
  assert.ok(!("records" in body), "must not emit an empty records array on failure");
});

test("OPTIONS preflight is answered with CORS headers", async () => {
  const res = await handler(makeRequest("/data/incidents.json", { method: "OPTIONS" }));
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
