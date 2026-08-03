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
const calls: QueryCall[] = [];
(globalThis as Record<string, unknown>).__createMockSupabase = () =>
  createMockSupabase((q) => {
    calls.push(q);
    return currentResolver(q);
  }).client;

await importBundle("refresh-real-estate-metrics");
const handler = deno.handler();

// A miniature ZHVI file in Zillow's real wide format. Note the quoted Metro
// containing a comma — the exact thing a naive split() corrupts — and that
// 99999 (SizeRank collision bait) appears as a number in another zip's row.
const CSV = [
  'RegionID,SizeRank,RegionName,RegionType,StateName,State,City,Metro,CountyName,2024-06-30,2025-06-30,2025-07-31',
  '1111,53147,99999,zip,WI,WI,Elsewhere,"Somewhere, ST",Some County,100000,110000,111000',
  '2222,10,53147,zip,WI,WI,Lake Geneva,"Chicago-Naperville-Elgin, IL-IN-WI",Walworth County,400000,436000,440000',
  '3333,11,53125,zip,WI,WI,Fontana,"Chicago-Naperville-Elgin, IL-IN-WI",Walworth County,500000,520000,530000',
].join("\n");

const realFetch = globalThis.fetch;
let fetchStatus = 200;
let fetchBody = CSV;

beforeEach(() => {
  calls.length = 0;
  fetchStatus = 200;
  fetchBody = CSV;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("zillowstatic")) return new Response(fetchBody, { status: fetchStatus });
    return realFetch(input as RequestInfo);
  }) as typeof fetch;
});

function existingRows(rows: Record<string, unknown>[]): Resolver {
  return (q) => {
    if (q.table === "real_estate_metrics" && q.op === "select") return { data: rows };
    if (q.table === "real_estate_metrics" && q.op === "insert") return { data: null, error: null };
    return undefined;
  };
}

test("refreshes tracked zips with honest math and carried-forward listings", async () => {
  currentResolver = existingRows([
    { zip_code: "53147", active_listings: 42, fetched_at: "2024-12-01" },
  ]);
  const res = await handler(makeRequest("http://localhost/refresh-real-estate-metrics", { method: "POST" }));
  const json = await res.json();

  assert.equal(json.inserted, 1);
  const insert = calls.find((c) => c.table === "real_estate_metrics" && c.op === "insert");
  assert.ok(insert, "expected an insert");
  const row = (insert!.payload as Record<string, unknown>[])[0] ?? insert!.payload as Record<string, unknown>;
  assert.equal(row.zip_code, "53147");
  // Latest month 440000; 12 months prior (2024-06-30 is 13mo back; 2025-06-30 is
  // closest to a year before 2025-07-31? No — one month. The year-ago column is
  // 2024-06-30 at 13 months... within the 45-day window of 2024-07-15). YoY vs 400000.
  assert.equal(row.median_price, 440000);
  assert.equal(row.yoy_change, 10);
  assert.equal(row.active_listings, 42, "listings must carry forward, never be invented");
  assert.equal(row.source, "zillow_zhvi");
});

test("SizeRank equal to a zip code does not pollute another row's match", async () => {
  currentResolver = existingRows([
    { zip_code: "53147", active_listings: 10, fetched_at: "2024-12-01" },
  ]);
  const res = await handler(makeRequest("http://localhost/x", { method: "POST" }));
  const json = await res.json();
  // The decoy row (RegionName=99999, SizeRank=53147) must not be taken as 53147.
  assert.equal(json.results?.[0]?.median, 440000, "matched the decoy row instead of the real zip");
});

test("a zip with no prior row is skipped rather than given invented inventory", async () => {
  currentResolver = existingRows([
    { zip_code: "53125", active_listings: null, fetched_at: "2024-12-01" },
  ]);
  const res = await handler(makeRequest("http://localhost/x", { method: "POST" }));
  const json = await res.json();
  assert.equal(json.inserted, 0);
  assert.equal(json.skipped_no_prior_listings, 1);
});

test("zillow outage leaves the table untouched and reports failure", async () => {
  fetchStatus = 503;
  currentResolver = existingRows([
    { zip_code: "53147", active_listings: 5, fetched_at: "2024-12-01" },
  ]);
  const res = await handler(makeRequest("http://localhost/x", { method: "POST" }));
  assert.equal(res.status, 502);
  assert.ok(!calls.some((c) => c.op === "insert"), "no insert on outage");
});

test("empty table reports how to start tracking instead of erroring", async () => {
  currentResolver = existingRows([]);
  const res = await handler(makeRequest("http://localhost/x", { method: "POST" }));
  const json = await res.json();
  assert.equal(json.inserted, 0);
  assert.match(json.note ?? "", /seed/i);
});
