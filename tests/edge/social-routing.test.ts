import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routePost, composerUrl } from "../../supabase/functions/_shared/socialRouting.ts";

const ALL_ON = { x: true, facebook: true, instagram: true };

test("X posts go out through the API when credentials exist", () => {
  const route = routePost({ platform: "x", toggles: ALL_ON, apiConfigured: true });
  assert.equal(route.action, "api");
});

test("X falls back to a human rather than being dropped when credentials are missing", () => {
  const route = routePost({ platform: "x", toggles: ALL_ON, apiConfigured: false });
  assert.equal(route.action, "manual");
});

test("Facebook and Instagram queue for a human, never silently succeed", () => {
  // The whole point of the change: these used to be marked "simulated" and
  // treated as handled, so the pipeline wrote posts that reached nobody.
  for (const platform of ["facebook", "instagram"]) {
    const route = routePost({ platform, toggles: ALL_ON, apiConfigured: false });
    assert.equal(route.action, "manual", `${platform} must wait for a human`);
    assert.match(route.reason, /no API access/);
  }
});

test("a platform switched off in settings is skipped, not queued at a person", () => {
  const route = routePost({
    platform: "facebook",
    toggles: { ...ALL_ON, facebook: false },
    apiConfigured: false,
  });
  assert.equal(route.action, "skip");
});

test("each toggle only governs its own platform", () => {
  const toggles = { x: true, facebook: false, instagram: true };
  assert.equal(routePost({ platform: "facebook", toggles, apiConfigured: false }).action, "skip");
  assert.equal(routePost({ platform: "instagram", toggles, apiConfigured: false }).action, "manual");
  assert.equal(routePost({ platform: "x", toggles, apiConfigured: true }).action, "api");
});

test("an unrecognised platform is never handed to an operator", () => {
  // "website" is a valid platform value in post_queue but is not a social send,
  // and an unknown value should not put a card on someone's screen with no app
  // to post it to.
  for (const platform of ["website", "tiktok", ""]) {
    assert.equal(
      routePost({ platform, toggles: ALL_ON, apiConfigured: false }).action,
      "skip",
      `${platform || "(empty)"} must not be queued for manual posting`,
    );
  }
});

test("composerUrl covers every platform that can be queued manually", () => {
  for (const platform of ["facebook", "instagram", "x"] as const) {
    const url = composerUrl(platform);
    assert.ok(url && url.startsWith("https://"), `${platform} needs a composer link`);
  }
  assert.equal(composerUrl("website"), null);
});

// ---------------------------------------------------------------------------
// Regression guard on the caller.
// ---------------------------------------------------------------------------

const processQueue = readFileSync("supabase/functions/process-post-queue/index.ts", "utf8");

test("process-post-queue no longer marks anything 'simulated'", () => {
  assert.ok(
    !/status:\s*["']simulated["']/.test(processQueue),
    "a post marked 'simulated' is written, counted as handled, and never seen by " +
      "a reader — it must go to 'awaiting_manual' so a human can publish it",
  );
});

test("process-post-queue routes through the tested decision, not an inline branch", () => {
  assert.ok(
    /routePost\(/.test(processQueue),
    "the platform decision must come from socialRouting so it stays covered",
  );
  assert.ok(
    /status:\s*["']awaiting_manual["']/.test(processQueue),
    "posts with no API path must be parked for manual publishing",
  );
});

test("the Post Today screen and the router agree on composer links", () => {
  // Two copies of the same map, one in Deno and one in the browser bundle. If
  // they drift, the operator is sent to the wrong app.
  const page = readFileSync("src/pages/PostToday.tsx", "utf8");
  for (const platform of ["facebook", "instagram", "x"] as const) {
    const url = composerUrl(platform);
    assert.ok(
      page.includes(`"${url}"`),
      `PostToday is missing the composer URL for ${platform} (${url})`,
    );
  }
});

test("awaiting_manual and skipped are permitted by the status constraint", () => {
  const migration = readFileSync(
    "supabase/migrations/20260915130000_manual_social_posting.sql",
    "utf8",
  );
  for (const status of ["awaiting_manual", "skipped"]) {
    assert.ok(
      migration.includes(`'${status}'::text`),
      `post_queue_status_check must allow '${status}' or every write is rejected`,
    );
  }
  // The historical rows still carry it; dropping it from the constraint would
  // make the table fail validation on its own contents.
  assert.ok(migration.includes("'simulated'::text"), "existing rows still use 'simulated'");
});
