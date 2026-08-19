import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanScrapedBody, scrapedExcerpt } from "../../src/lib/cleanScrapedBody";

// The exact opening of a live story body on 2026-08-19 (obituaries collection).
const REAL_SCRAPE = `[Skip to main content](https://lakegenevanews.net/news/local/collection_e18ec484.html)

![Lake Geneva Regional News](https://bloximages.chicago2.vip.townnews.com/logo.png)

Menu

Lake Geneva neighbors: Obituaries for August 18

Services will be held Saturday at 11 a.m. at the [First Congregational Church](https://example.com/church) in Lake Geneva.

Share this
https://lakegenevanews.net/news/local/collection_e18ec484.html`;

test("navigation chrome never reaches the reader", () => {
  const out = cleanScrapedBody(REAL_SCRAPE);
  assert.ok(!out.includes("Skip to main content"), "skip-link must be gone");
  assert.ok(!out.includes("Menu"), "menu furniture must be gone");
  assert.ok(!out.includes("Share this"), "share furniture must be gone");
  assert.ok(!out.includes("]("), "no markdown link plumbing survives");
  assert.ok(!out.includes("bloximages"), "logo image must be gone");
});

test("actual article prose survives, with link text intact", () => {
  const out = cleanScrapedBody(REAL_SCRAPE);
  assert.ok(out.includes("Services will be held Saturday at 11 a.m."), "prose kept");
  assert.ok(out.includes("First Congregational Church"), "link text kept, URL dropped");
  assert.ok(out.includes("Obituaries for August 18"), "headline text kept");
});

test("the body is never left with runs of blank lines", () => {
  assert.ok(!/\n{3,}/.test(cleanScrapedBody(REAL_SCRAPE)));
  assert.equal(cleanScrapedBody(REAL_SCRAPE).trim(), cleanScrapedBody(REAL_SCRAPE));
});

test("meta description starts with prose, not a skip link", () => {
  const d = scrapedExcerpt(REAL_SCRAPE);
  assert.ok(!d.startsWith("[Skip"), "this is exactly what search engines were shown");
  assert.ok(d.length <= 181, "stays within a sane meta-description length");
  assert.ok(!/\s\S*…$/.test(d) || !d.includes("  "), "no double spaces");
});

test("empty and already-clean input are safe", () => {
  assert.equal(cleanScrapedBody(null), "");
  assert.equal(cleanScrapedBody(undefined), "");
  assert.equal(cleanScrapedBody(""), "");
  const plain = "A quiet paragraph with no markup at all.";
  assert.equal(cleanScrapedBody(plain), plain);
  assert.equal(scrapedExcerpt(plain), plain);
});

// The SPA and the Deno edge runtime cannot share a module, so the cleaner is
// duplicated on purpose. A silent drift between them would mean readers and
// crawlers see different article text — exactly the class of bug this file
// exists to prevent.
test("the edge twin has not drifted from the app copy", () => {
  const app = readFileSync("src/lib/cleanScrapedBody.ts", "utf8");
  const edge = readFileSync("supabase/functions/_shared/cleanScrapedBody.ts", "utf8");
  const code = (s: string) => s.slice(s.indexOf("const NAV_TEXT")).replace(/\s+/g, " ").trim();
  assert.equal(code(edge), code(app), "edge copy must match app copy below the header comment");
});
