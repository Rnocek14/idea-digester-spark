import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const NEWS_INGEST_SECRET = Deno.env.get("NEWS_INGEST_SECRET")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest-news`;

const testUrl =
  `https://lakegenevanews.net/news/curl-smoketest-${Date.now()}`;

const payload = {
  source: "lakegenevanews",
  url: testUrl,
  title: "Curl smoketest article",
  content: "Smoketest body — exercising ingest-news end-to-end.",
  published_at: new Date().toISOString(),
  author: "Smoketest",
  category: "news",
  metadata: { scraped_at: new Date().toISOString(), source_type: "puppeteer" },
};

Deno.test("ingest-news rejects unauthenticated requests", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("ingest-news inserts then dedupes", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${NEWS_INGEST_SECRET}`,
  };

  const first = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const firstJson = await first.json();
  console.log("first:", firstJson);
  assertEquals(first.status, 200);
  assertEquals(firstJson.status, "inserted");
  assert(firstJson.article_id, "article_id present");

  const second = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const secondJson = await second.json();
  console.log("second:", secondJson);
  assertEquals(second.status, 200);
  assertEquals(secondJson.status, "skipped");
  assertEquals(secondJson.reason, "duplicate_url");
});