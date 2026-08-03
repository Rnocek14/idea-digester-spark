import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const indexHtml = readFileSync("index.html", "utf8");

// Regression guard. react-helmet-async APPENDS meta tags rather than replacing
// them, and social crawlers read the FIRST matching tag. A static og:title in
// index.html therefore wins over the per-page one, and every shared link
// previews as the generic site card — which is exactly the bug this prevents.
// og:url and og:type were originally exempted here on the belief that PageMeta
// "only overrides them when a page supplies its own". It doesn't — PageMeta
// sets both unconditionally, so the static copies shadowed every page: each of
// the ~40 indexed routes advertised the homepage URL, and article pages
// previewed as og:type=website. Same for the static description. Only tags
// PageMeta genuinely leaves unset may live in index.html.
test("index.html does not hardcode meta that PageMeta always sets", () => {
  for (const tag of [
    "description",
    "og:title",
    "og:description",
    "og:url",
    "og:type",
    "twitter:title",
    "twitter:description",
  ]) {
    const attr = tag.startsWith("og:") ? "property" : "name";
    const re = new RegExp(`<meta\\s+${attr}=["']${tag}["']`, "i");
    assert.ok(
      !re.test(indexHtml),
      `index.html must not hardcode ${tag} — PageMeta.tsx sets it on every page, ` +
        "and helmet appends rather than replaces, so the static tag wins with crawlers.",
    );
  }
});

test("index.html keeps the site-level defaults PageMeta does not always set", () => {
  for (const tag of ["og:image", "og:site_name"]) {
    assert.ok(
      new RegExp(`<meta\\s+property=["']${tag}["']`, "i").test(indexHtml),
      `index.html should keep a default ${tag}`,
    );
  }
});

// Pairs with the test above: a tag may only be dropped from index.html
// because PageMeta unconditionally supplies it. If PageMeta ever makes one
// conditional, the tag silently disappears from every page.
test("PageMeta sets the meta index.html no longer defaults, unconditionally", () => {
  const pageMeta = readFileSync("src/components/PageMeta.tsx", "utf8");
  for (const tag of ["description", "og:url", "og:type"]) {
    const attr = tag.startsWith("og:") ? "property" : "name";
    const re = new RegExp(`<meta ${attr}="${tag}" content=\\{[^}]+\\} />`);
    const line = pageMeta.split("\n").find((l) => re.test(l));
    assert.ok(line, `PageMeta.tsx must render a ${tag} meta tag`);
    assert.ok(
      !line!.includes("?") && !line!.includes("&&"),
      `PageMeta.tsx renders ${tag} conditionally, but index.html no longer carries a ` +
        "default — pages hitting the falsy branch would ship with no " + tag,
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
