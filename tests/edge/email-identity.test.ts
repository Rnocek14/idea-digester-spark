import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  siteOrigin,
  fromAddress,
  referralUrl,
  unsubscribeUrl,
  bulkMailHeaders,
  DEFAULT_SITE_ORIGIN,
} from "../../supabase/functions/_shared/emailIdentity.ts";
import { LAKE_GENEVA_DEFAULTS } from "../../supabase/functions/_shared/cityConfig.ts";

// ---------------------------------------------------------------------------
// The helpers
// ---------------------------------------------------------------------------

test("siteOrigin normalizes whatever shape site_domain is stored in", () => {
  assert.equal(siteOrigin({ site_domain: "example.com" }), "https://example.com");
  assert.equal(siteOrigin({ site_domain: "https://example.com" }), "https://example.com");
  assert.equal(siteOrigin({ site_domain: "https://example.com/" }), "https://example.com");
  assert.equal(siteOrigin({ site_domain: "http://example.com" }), "https://example.com");
});

test("siteOrigin returns empty (never 'https://undefined') when unset", () => {
  assert.equal(siteOrigin({ site_domain: "" }), "");
  assert.equal(siteOrigin({ site_domain: null as unknown as string }), "");
});

test("fromAddress is built from the city's own name and address", () => {
  assert.equal(
    fromAddress({ site_name: "Testville Brief", from_email: "news@testville.example" }),
    "Testville Brief <news@testville.example>",
  );
});

test("DEFAULT_SITE_ORIGIN tracks the canonical domain, not a second one", () => {
  assert.equal(DEFAULT_SITE_ORIGIN, `https://${LAKE_GENEVA_DEFAULTS.site_domain}`);
  assert.ok(
    !DEFAULT_SITE_ORIGIN.includes("lakegeneva.news"),
    "the transactional fallback must not point at a different domain than the site",
  );
});

test("referralUrl only produces a link for a code that can actually be credited", () => {
  // increment_referral_count matches referred_by_code against a REAL
  // subscribers.referral_code. A link carrying anything else credits nobody,
  // so callers need null here to know to drop the block entirely.
  assert.equal(referralUrl("https://example.com", "ABC123"), "https://example.com/?ref=ABC123");
  assert.equal(referralUrl("https://example.com", null), null);
  assert.equal(referralUrl("https://example.com", ""), null);
  assert.equal(referralUrl("https://example.com", "   "), null);
  assert.equal(referralUrl("", "ABC123"), null);
});

test("referralUrl escapes a code that would otherwise break the query string", () => {
  assert.equal(referralUrl("https://example.com", "A B&c"), "https://example.com/?ref=A%20B%26c");
});

test("unsubscribeUrl points at the token endpoint", () => {
  assert.equal(
    unsubscribeUrl("https://proj.supabase.co", "tok123"),
    "https://proj.supabase.co/functions/v1/unsubscribe?token=tok123",
  );
});

test("bulkMailHeaders carry the one-click pair Gmail and Yahoo require", () => {
  const headers = bulkMailHeaders("https://proj.supabase.co/functions/v1/unsubscribe?token=t");
  assert.equal(
    headers["List-Unsubscribe"],
    "<https://proj.supabase.co/functions/v1/unsubscribe?token=t>",
    "the URL must be in angle brackets per RFC 2369",
  );
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

// ---------------------------------------------------------------------------
// Source-level guards.
//
// Every bug these cover actually shipped: a `href="#"` unsubscribe, a literal
// "[link]" in the plain-text part, and newsletter links hardcoded to a domain
// the site does not serve. None of them are reachable by unit-testing a
// function — they are properties of the templates — and all of them are only
// visible in a real inbox, which is the worst place to find out.
// ---------------------------------------------------------------------------

const autopilot = readFileSync("supabase/functions/autopilot-newsletter/index.ts", "utf8");
const sendNewsletter = readFileSync("supabase/functions/send-newsletter/index.ts", "utf8");

test("no newsletter function hardcodes a reader-facing domain", () => {
  for (const [name, src] of [
    ["autopilot-newsletter", autopilot],
    ["send-newsletter", sendNewsletter],
  ] as const) {
    assert.ok(
      !/https:\/\/lakegeneva\.news/.test(src),
      `${name} hardcodes a site domain — it must come from city_config, or city #2 ` +
        `sends its readers to city #1`,
    );
  }
});

test("every per-subscriber placeholder is substituted by BOTH senders", () => {
  // send-newsletter ships a body built by autopilot-newsletter. A placeholder
  // one of them introduces and the other does not replace reaches the inbox raw.
  const placeholders = [...new Set(autopilot.match(/\[[A-Z_]{3,}\]/g) ?? [])];
  assert.ok(placeholders.length > 0, "expected the templates to use placeholders");

  for (const token of placeholders) {
    const name = token.slice(1, -1);
    const substitution = new RegExp(`\\\\\\[${name}\\\\\\]`);
    for (const [fn, src] of [
      ["autopilot-newsletter", autopilot],
      ["send-newsletter", sendNewsletter],
    ] as const) {
      assert.ok(
        substitution.test(src),
        `${fn} never substitutes ${token} — it would ship to readers verbatim`,
      );
    }
  }
});

test("no newsletter template leaves a dead unsubscribe link", () => {
  assert.ok(
    !/>\s*Unsubscribe\s*<\/a>/.test(autopilot.replace(/href="\[UNSUBSCRIBE_URL\]"/g, "href=OK")) ||
      !/href="#"[^>]*>\s*Unsubscribe/.test(autopilot),
    "an Unsubscribe anchor must point at [UNSUBSCRIBE_URL], never '#'",
  );
  assert.ok(
    !/Unsubscribe:\s*\[link\]/.test(autopilot),
    "the plain-text part must carry [UNSUBSCRIBE_URL], not the literal '[link]'",
  );
});

test("both senders set the bulk-mail headers on every send", () => {
  for (const [name, src] of [
    ["autopilot-newsletter", autopilot],
    ["send-newsletter", sendNewsletter],
  ] as const) {
    assert.ok(
      /headers:\s*bulkMailHeaders\(/.test(src),
      `${name} sends without List-Unsubscribe headers — Gmail and Yahoo require ` +
        `one-click unsubscribe from bulk senders`,
    );
  }
});

test("both senders read the fields the per-subscriber links need", () => {
  for (const [name, src] of [
    ["autopilot-newsletter", autopilot],
    ["send-newsletter", sendNewsletter],
  ] as const) {
    assert.ok(
      /referral_code/.test(src),
      `${name} must select referral_code or every referral link is uncredited`,
    );
  }
});
