import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const rootRoute = readFileSync("src/routes/__root.tsx", "utf8");

// Pages are server-rendered, so crawlers that skip JavaScript read the head the
// root route and each page's PageMeta produce. The root supplies the homepage
// defaults that a page without its own PageMeta falls back to.
test("root route provides homepage social defaults", () => {
  for (const tag of ["og:title", "og:description", "twitter:title", "twitter:description", "og:site_name", "og:type"]) {
    assert.ok(rootRoute.includes(tag), `__root.tsx must provide a default ${tag}`);
  }
});

test("PageMeta sets canonical, title, and social tags per page", () => {
  const pageMeta = readFileSync("src/components/PageMeta.tsx", "utf8");
  for (const needed of ['rel="canonical"', "og:title", "og:description", "twitter:title"]) {
    assert.ok(pageMeta.includes(needed), `PageMeta.tsx must set ${needed}`);
  }
});

// Every guide page file must be advertised in the sitemap; a guide that exists but
// is missing from the sitemap was a real drift once (streblow-boats).
test("every guide route is also in the sitemap", () => {
  const sitemap = readFileSync("scripts/generate-sitemap.ts", "utf8");
  const guides = readdirSync("src/routes/guides")
    .filter((f) => f !== "index.tsx")
    .map((f) => `/guides/${f.replace(/\.tsx$/, "")}`);
  assert.ok(guides.length > 15, "expected to find the guide route files");
  const missing = guides.filter((p) => !sitemap.includes(`"${p}"`));
  assert.deepEqual(missing, [], `guide routes missing from the sitemap: ${missing.join(", ")}`);
});

// The guide typography regression: @tailwindcss/typography is a dependency but was never
// registered in tailwind.config.ts, so every `prose` class emitted zero CSS while
// Tailwind's preflight zeroed paragraph margins and stripped list bullets. Guides render
// through .guide-prose with explicit rules instead — if those rules go missing, articles
// silently collapse into one wall of text again.
test("guide typography rules exist and restore paragraph and list styling", () => {
  const css = readFileSync("src/styles.css", "utf8");
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
