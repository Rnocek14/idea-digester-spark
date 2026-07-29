import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const indexHtml = readFileSync("index.html", "utf8");

// Regression guard. react-helmet-async APPENDS meta tags rather than replacing
// them, and social crawlers read the FIRST matching tag. A static og:title in
// index.html therefore wins over the per-page one, and every shared link
// previews as the generic site card — which is exactly the bug this prevents.
test("index.html does not hardcode per-page social meta", () => {
  for (const tag of ["og:title", "og:description", "twitter:title", "twitter:description"]) {
    const attr = tag.startsWith("og:") ? "property" : "name";
    const re = new RegExp(`<meta\\s+${attr}=["']${tag}["']`, "i");
    assert.ok(
      !re.test(indexHtml),
      `index.html must not hardcode ${tag} — PageMeta.tsx owns it per page`,
    );
  }
});

test("index.html keeps the site-level defaults PageMeta does not always set", () => {
  for (const tag of ["og:image", "og:site_name", "og:type"]) {
    assert.ok(
      new RegExp(`<meta\\s+property=["']${tag}["']`, "i").test(indexHtml),
      `index.html should keep a default ${tag}`,
    );
  }
});

test("PageMeta sets canonical, title, and social tags per page", () => {
  const pageMeta = readFileSync("src/components/PageMeta.tsx", "utf8");
  for (const needed of ['rel="canonical"', "og:title", "og:description", "twitter:title"]) {
    assert.ok(pageMeta.includes(needed), `PageMeta.tsx must set ${needed}`);
  }
});

// Only asserted when a build has been prerendered locally; skipped in a clean checkout.
test("prerendered output carries real content and one og:title", { skip: !existsSync("dist/guides/yerkes-observatory/index.html") }, () => {
  const html = readFileSync("dist/guides/yerkes-observatory/index.html", "utf8");
  const ogTitles = html.match(/<meta property="og:title"/g) ?? [];
  assert.equal(ogTitles.length, 1, "prerendered page must have exactly one og:title");
  assert.ok(html.includes('"@type":"FAQPage"'), "FAQ schema should be baked in");
  assert.ok(html.length > 10000, "prerendered page should contain real rendered content");
});
