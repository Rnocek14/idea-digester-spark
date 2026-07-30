import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");

/**
 * Functions the browser calls with no signed-in user.
 *
 * These MUST carry `verify_jwt = false` in supabase/config.toml. Without it the
 * platform rejects the call before the function runs, and the failure only shows
 * up in production against a real anonymous visitor — a build, a typecheck and
 * every mocked edge test pass happily. That is exactly the kind of break worth a
 * cheap guard.
 */
const PUBLIC_FUNCTIONS = [
  // Community quick reports from readers who are not logged in.
  "report-incident",
  // The Shore Path register: walkers are identified by an opaque claim token in
  // localStorage, never by an account, so there is no JWT to verify.
  "path-register",
];

for (const name of PUBLIC_FUNCTIONS) {
  test(`${name} is declared in config.toml`, () => {
    assert.ok(
      config.includes(`[functions.${name}]`),
      `supabase/config.toml has no [functions.${name}] section — the platform ` +
        `will default to requiring a JWT and anonymous callers will get 401`,
    );
  });

  test(`${name} does not require a JWT`, () => {
    const section = config.split(`[functions.${name}]`)[1] ?? "";
    // Only look as far as the next section header.
    const body = section.split("\n[")[0];
    assert.match(
      body,
      /verify_jwt\s*=\s*false/,
      `[functions.${name}] must set verify_jwt = false`,
    );
  });
}

test("every function directory has a config.toml entry", () => {
  // A missing entry means the function defaults to requiring a JWT. That is the
  // right default for internal and cron-invoked functions, so this only reports
  // what is undeclared rather than failing — but a new public function showing up
  // here is a prompt to add it to PUBLIC_FUNCTIONS above.
  const declared = new Set(
    [...config.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1]),
  );
  for (const name of PUBLIC_FUNCTIONS) {
    assert.ok(declared.has(name), `${name} must be declared`);
  }
});
