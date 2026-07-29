import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tier3Match,
  tier4Match,
  matchAnyKeyword,
  redactPersonalDetails,
} from "../../supabase/functions/_shared/incidentGate.ts";

test("tier4Match rejects public-safety-critical content", () => {
  assert.equal(tier4Match("Arrest made after pursuit on Hwy 50"), "arrest");
  assert.equal(tier4Match("Man charged with burglary"), "charged with");
  assert.equal(tier4Match("Fatal crash closes highway"), "fatal ");
  assert.equal(tier4Match("Juvenile reported missing from home"), "juvenile");
  assert.equal(tier4Match("Suspected overdose on Main St"), "overdose");
});

test("tier4Match passes routine content", () => {
  assert.equal(tier4Match("Road closed for water main repair"), null);
  assert.equal(tier4Match("Power outage affecting downtown"), null);
  assert.equal(tier4Match("Kitchen fire quickly extinguished, no injuries"), null);
});

test("tier3Match holds sensitive-but-unconfirmed content", () => {
  assert.equal(tier3Match("Heavy police presence near the beach"), "police presence");
  assert.equal(tier3Match("Silver Alert issued for missing driver"), "silver alert");
  assert.equal(tier3Match("Shots fired call on the east side"), "shots fired");
  assert.equal(tier3Match("Crews responding to rollover on 120"), "rollover");
});

test("tier3Match passes clearly-routine content", () => {
  assert.equal(tier3Match("Farmers market moves indoors this weekend"), null);
  assert.equal(tier3Match("Lane closed for repaving Tuesday"), null);
});

test("matchAnyKeyword is case-insensitive and substring-based", () => {
  assert.equal(matchAnyKeyword("ARREST WARRANT issued", ["arrest"]), "arrest");
  assert.equal(matchAnyKeyword("nothing here", ["arrest"]), null);
});

// Regression: the original TIER_4_REJECT list matched "arrest" and "charged with" but
// none of the phrasings a police blotter actually uses. Every line below passed the gate
// and would have published verbatim — including the name.
test("tier4Match catches custody and charging phrasings, not just the word arrest", () => {
  for (const line of [
    "John Smith was taken into custody at the scene",
    "Driver was cited for operating while intoxicated",
    "Suspect was booked into Walworth County Jail",
    "The man was identified as a 34-year-old resident",
    "Case referred to the district attorney",
    "Subject apprehended after a short foot pursuit",
    "Warrant served at a residence on Main St",
    "He was detained pending charges",
  ]) {
    assert.ok(
      tier4Match(line) !== null,
      `must not auto-publish: ${line}`,
    );
  }
});

test("tier4Match still passes genuinely routine incident text", () => {
  for (const line of [
    "Water main break closes a lane on Wells Street",
    "Power outage affecting downtown businesses",
    "Tree down across a sidewalk after high wind",
    "Lane closed for repaving Tuesday",
  ]) {
    assert.equal(tier4Match(line), null, `should be publishable: ${line}`);
  }
});

test("redactPersonalDetails strips identifying detail from scraped text", () => {
  const out = redactPersonalDetails(
    "Victim Jane Doe, a 34-year-old, reported a vehicle entered at 1428 Maple Street Apt 3B",
  );
  assert.ok(!/Jane Doe/.test(out), "personal names must be removed");
  assert.ok(!/1428/.test(out), "exact street number must be removed");
  assert.ok(!/34-year-old/.test(out), "age must be removed");
  assert.ok(!/Apt 3B/i.test(out), "unit number must be removed");
  assert.ok(/1400 block/.test(out), `should generalize to a block, got: ${out}`);
});

test("redactPersonalDetails keeps place names readable", () => {
  const out = redactPersonalDetails("Two-car crash reported near Williams Bay on Geneva Lake");
  assert.ok(/Williams Bay/.test(out), `place name lost: ${out}`);
  assert.ok(/Geneva Lake/.test(out), `place name lost: ${out}`);
});

test("redactPersonalDetails handles empty and plain input safely", () => {
  assert.equal(redactPersonalDetails(""), "");
  assert.equal(redactPersonalDetails("power outage downtown"), "power outage downtown");
});
