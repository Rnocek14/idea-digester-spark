import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression guard. Adding a guide means touching four files that have no
// compile-time link to each other: the route in App.tsx, the sitemap entry,
// the prerender list, and the card on /guides. Miss one and the page still
// renders perfectly for anyone who has the URL — which is why the gap survives
// review. This test caught /guides/streblow-boats-geneva-lake sitting in
// App.tsx, prerender and the index while being absent from sitemap.xml, and
// /guides/lake-geneva-winterfest never being prerendered.

const app = readFileSync("src/App.tsx", "utf8");
const sitemap = readFileSync("scripts/generate-sitemap.ts", "utf8");
const prerender = readFileSync("scripts/prerender.mjs", "utf8");
const index = readFileSync("src/pages/guides/GuidesIndex.tsx", "utf8");

/** Concrete (non-parameterised) /guides/* routes declared in App.tsx. */
function appGuideRoutes(): string[] {
  const found = app.match(/<Route\s+path="(\/guides\/[^":]+)"/g) ?? [];
  return [...new Set(found.map((m) => m.match(/"([^"]+)"/)![1]))].sort();
}

function pathsIn(source: string): Set<string> {
  return new Set((source.match(/['"]\/guides\/[a-z0-9/-]+['"]/g) ?? []).map((m) => m.slice(1, -1)));
}

// Deliberate omissions, each with a reason. Anything not listed here must be
// present — a bare "it's intentional" is not reviewable six months later.
const NOT_ON_INDEX = new Map([
  ["/guides/lake-geneva-shore-path/passport", "printable companion to the register, reached from it"],
]);

test("every guide route is in the sitemap", () => {
  const inSitemap = pathsIn(sitemap);
  for (const route of appGuideRoutes()) {
    assert.ok(
      inSitemap.has(route),
      `${route} has a route but no sitemap entry — crawlers will never discover it. ` +
        "Add it to staticEntries in scripts/generate-sitemap.ts.",
    );
  }
});

test("every guide route is prerendered", () => {
  const inPrerender = pathsIn(prerender);
  for (const route of appGuideRoutes()) {
    assert.ok(
      inPrerender.has(route),
      `${route} is not in scripts/prerender.mjs — shared links will preview as the ` +
        "generic site card and non-Google bots will see an empty page.",
    );
  }
});

test("every guide route is reachable from /guides", () => {
  const onIndex = pathsIn(index);
  for (const route of appGuideRoutes()) {
    if (NOT_ON_INDEX.has(route)) continue;
    assert.ok(
      onIndex.has(route),
      `${route} has no card on /guides, so no reader can find it by browsing. ` +
        "Add one, or record why not in NOT_ON_INDEX in this test.",
    );
  }
});

test("the sitemap and index do not point at guide routes that no longer exist", () => {
  const routes = new Set(appGuideRoutes());
  // The stop-detail route is /guides/lake-geneva-shore-path/:slug — its concrete
  // URLs come from the database at build time, not from App.tsx.
  const dynamic = (p: string) => p.startsWith("/guides/lake-geneva-shore-path/");
  for (const [label, paths] of [
    ["scripts/generate-sitemap.ts", pathsIn(sitemap)],
    ["src/pages/guides/GuidesIndex.tsx", pathsIn(index)],
  ] as const) {
    for (const p of paths) {
      if (p === "/guides" || dynamic(p)) continue;
      assert.ok(routes.has(p), `${label} links to ${p}, which has no route in App.tsx (404).`);
    }
  }
});
