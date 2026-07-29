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

// Two hardcoded route lists have to agree: scripts/prerender.mjs decides what gets
// crawlable HTML, scripts/generate-sitemap.ts decides what Google is told exists.
// They drifted once already — streblow-boats was prerendered and in llms.txt but absent
// from the sitemap, so the page existed and nothing advertised it. At fleet scale this
// rots silently, so it's asserted rather than remembered.
test("every prerendered guide route is also in the sitemap", () => {
  const prerender = readFileSync("scripts/prerender.mjs", "utf8");
  const sitemap = readFileSync("scripts/generate-sitemap.ts", "utf8");

  const prerendered = [...prerender.matchAll(/'(\/guides\/[a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(prerendered.length > 15, "expected to find the guide route list in prerender.mjs");

  const missing = prerendered.filter((p) => !sitemap.includes(`"${p}"`));
  assert.deepEqual(
    missing,
    [],
    `prerendered but missing from the sitemap: ${missing.join(", ")}`,
  );
});

// The guide typography regression: @tailwindcss/typography is a dependency but was never
// registered in tailwind.config.ts, so every `prose` class emitted zero CSS while
// Tailwind's preflight zeroed paragraph margins and stripped list bullets. Guides render
// through .guide-prose with explicit rules instead — if those rules go missing, articles
// silently collapse into one wall of text again.
test("guide typography rules exist and restore paragraph and list styling", () => {
  const css = readFileSync("src/index.css", "utf8");
  assert.ok(css.includes(".guide-prose p"), "guide paragraph spacing rule is missing");
  assert.ok(/\.guide-prose ul\s*\{[^}]*list-style:\s*disc/.test(css), "guide list bullets are missing");
  assert.ok(css.includes(".guide-prose .not-prose"), "the .not-prose opt-out must be honored");

  const shell = readFileSync("src/components/guides/GuideShell.tsx", "utf8");
  assert.ok(shell.includes("guide-prose"), "GuideShell must apply guide-prose");
  assert.ok(
    !/className="prose\b/.test(shell),
    "GuideShell must not rely on bare `prose` — the typography plugin is not registered",
  );
});
