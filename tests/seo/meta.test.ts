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

// The canonical host must not be hardcoded. PageMeta and the JSON-LD builders both used
// a literal "https://lakegenevabrief.com", which is invisible on one city and fatal on a
// fleet: every page of city #2 would emit rel=canonical pointing at city #1, telling
// Google city #2 is a duplicate and should not be indexed at all.
test("canonical origin is resolved, not hardcoded, in meta and schema builders", () => {
  for (const f of ["src/components/PageMeta.tsx", "src/lib/seo/jsonLd.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(
      !/const SITE\s*=\s*["']https:\/\//.test(src),
      `${f} must not hardcode a canonical host`,
    );
    assert.ok(src.includes("getSiteOrigin"), `${f} must resolve the origin via getSiteOrigin`);
  }
});

// Prerendering runs a real browser against 127.0.0.1. Without the injected override,
// every prerendered file would ship a canonical pointing at localhost.
test("prerender injects a production canonical origin before app boot", () => {
  const src = readFileSync("scripts/prerender.mjs", "utf8");
  assert.ok(src.includes("__SITE_ORIGIN__"), "prerender must set the canonical origin");
  assert.ok(src.includes("addInitScript"), "the override must be set before app code runs");
});

test("prerendered output never contains a localhost canonical", { skip: !existsSync("dist/guides/yerkes-observatory/index.html") }, () => {
  const html = readFileSync("dist/guides/yerkes-observatory/index.html", "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
  assert.ok(canonical.startsWith("https://"), `canonical should be absolute https, got: ${canonical}`);
  assert.ok(!/127\.0\.0\.1|localhost/.test(canonical), `canonical leaked a local host: ${canonical}`);
});
