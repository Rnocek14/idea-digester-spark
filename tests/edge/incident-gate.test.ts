import { test } from "node:test";
import assert from "node:assert/strict";
import { tier3Match, tier4Match, matchAnyKeyword } from "../../supabase/functions/_shared/incidentGate.ts";

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
