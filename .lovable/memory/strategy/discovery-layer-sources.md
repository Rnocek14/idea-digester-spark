---
name: Discovery-Layer Source Rule
description: Google News RSS, Reddit, and other aggregators are lead-discovery only — never eligible for auto-publish
type: feature
---
Aggregator sources (Google News RSS, Reddit, future Bing/NewsAPI) are **discovery layers**, not primary sources.

**Rule:** if `sources.metadata->>'discovery_layer' = 'true'`, the item must be held for human review even if it otherwise passes auto-publish gates. Use them to surface what's happening regionally, then have an editor (or AI with verification step) re-source from the underlying publisher before publishing.

**Trust scores:** discovery-layer sources cap at trust_score 6. Native publisher RSS = 7-10.

**Why:** Google News attributions are syndicated snippets, often missing canonical URL, can include rumor/PR/listicles. Reddit is unverified user content. Auto-publishing from these poisons the brand.

**Currently flagged discovery_layer = true:** all 4 Google News RSS feeds (Lake Geneva, Walworth County, Williams Bay, Fontana).