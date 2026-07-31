import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// LakeGenevaShorePath.tsx keeps a hardcoded STOP_INDEX so the stop list and its
// ItemList schema render even if the database fetch fails. That resilience is
// worth having, but it duplicates shore_path_stops — and duplication drifts.
//
// It already did: the sourced-content migrations renamed four stops and the
// static list still carried the old names, so the page linked "Cedar Point Park"
// to a page titled "Cedar Point Path Stretch". Worse, the old name asserted it
// was a public park when it is private residential property.
//
// This test is the guard. It reads the names the content migrations set and
// fails if any of them is missing from STOP_INDEX.

const page = readFileSync("src/pages/guides/LakeGenevaShorePath.tsx", "utf8");

const MIGRATION_DIR = "supabase/migrations";
const contentMigrations = readdirSync(MIGRATION_DIR)
  .filter((f) => f.includes("shore_path_stop_content"))
  .map((f) => readFileSync(`${MIGRATION_DIR}/${f}`, "utf8"));

/** Every `name = 'X'` a content migration sets, paired with the slug it targets. */
function renamesFromMigrations(): Array<{ slug: string; name: string }> {
  const out: Array<{ slug: string; name: string }> = [];
  for (const sql of contentMigrations) {
    // Each statement runs UPDATE ... SET ... WHERE slug = '...';
    for (const stmt of sql.split(/;\s*\n/)) {
      if (!/UPDATE\s+public\.shore_path_stops/i.test(stmt)) continue;
      const slug = stmt.match(/WHERE\s+slug\s*=\s*'([^']+)'/i)?.[1];
      const name = stmt.match(/^\s*name\s*=\s*'((?:[^']|'')*)'/im)?.[1];
      if (slug && name) out.push({ slug, name: name.replace(/''/g, "'") });
    }
  }
  return out;
}

test("content migrations were parsed at all", () => {
  assert.ok(contentMigrations.length > 0, "expected shore_path_stop_content migrations to exist");
  assert.ok(
    renamesFromMigrations().length > 0,
    "expected at least one stop rename to parse out of the migrations",
  );
});

test("every stop renamed by a migration carries that name in STOP_INDEX", () => {
  for (const { slug, name } of renamesFromMigrations()) {
    // The slug must be in the static index...
    assert.ok(
      page.includes(`slug: "${slug}"`),
      `STOP_INDEX is missing slug "${slug}"`,
    );
    // ...on the same line as the migration's name.
    const line = page
      .split("\n")
      .find((l) => l.includes(`slug: "${slug}"`) && l.includes("name:"));
    assert.ok(line, `no STOP_INDEX entry line found for "${slug}"`);
    assert.ok(
      line!.includes(`name: "${name}"`),
      `STOP_INDEX has a stale name for "${slug}".\n  migration: ${name}\n  page:      ${line!.trim()}`,
    );
  }
});

test("STOP_INDEX still holds all sixteen stops, in ascending mile order", () => {
  const entries = [...page.matchAll(/\{\s*slug: "([^"]+)", name: "[^"]*", community: "[^"]*", mile: ([\d.]+) \}/g)];
  assert.equal(entries.length, 16, "the passport, the register and the copy all assume sixteen stops");

  const slugs = entries.map((m) => m[1]);
  assert.equal(new Set(slugs).size, 16, "duplicate slug in STOP_INDEX");

  const miles = entries.map((m) => Number(m[2]));
  for (let i = 1; i < miles.length; i++) {
    assert.ok(
      miles[i] >= miles[i - 1],
      `STOP_INDEX is out of walking order at ${slugs[i]} (mile ${miles[i]} after ${miles[i - 1]})`,
    );
  }
});

test("no stop is still described as a public park that research found private", () => {
  // Cedar Point is a private residential subdivision. Any copy calling it a park
  // sends readers onto somebody's lawn, so the name must not come back.
  assert.ok(
    !/name: "Cedar Point Park"/.test(page),
    'Cedar Point must not be called a "Park" — it is a private residential subdivision',
  );
});
