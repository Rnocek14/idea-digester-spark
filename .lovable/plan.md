## What's actually happening

The site is not short on content. The database has, in the last 14 days of `auto_published` stories that match the homepage's filters (safe/soft_sensitive, geo_tier 0–2, publish_date within window, has body):

- **180 Tier-1 (Lake Geneva)** stories
- **13 Tier-2 (Walworth County)** stories
- **149 Tier-0 (regional)** stories

But the homepage console reports `tier1=0, tier2=0, tier0=5`. So the data is in the DB, RLS lets the anon user read it, and the gate is doing its job — yet zero hyperlocal stories reach the page.

## The blocker

`src/pages/LakeGenevaV2.tsx` line 407–409 in the main fetch:

```ts
.order("geo_tier", { ascending: true })   // ← 0 comes first, not 1
.order("created_at", { ascending: false })
.limit(80);
```

`ascending: true` puts geo_tier **0 first**, then 1, then 2. With ~149 fresh Tier-0 rows in the window, the first 80 rows returned to the client are almost all Tier-0. The Tier-1 and Tier-2 stories never even reach the client, so the quota algorithm has nothing to promote into the top slots.

The comment on the line even says "Tier 1 first, then 2, then 0" — the code does the opposite. Same bug in the 3-week thin-feed fallback (line 428).

## Secondary issue worth fixing while we're in there

The body-filter (`hasBody`) drops stories with no `summary` / `content_website` / `content_lg_base`. Tier-2 has 34 rows but only **13 with a usable body** (~62% drop rate). That's a content-pipeline issue, not a homepage bug — the ingestion is saving titles but not summaries for many Walworth County items. Worth flagging separately, but the immediate "no articles" symptom is 100% the sort-order bug.

## Fix

Two-line change in `src/pages/LakeGenevaV2.tsx`:

1. Line ~407 (main query): change `ascending: true` → `ascending: false` so Tier-2 → Tier-1 → Tier-0 ordering is returned, ensuring all hyperlocal rows fit inside the 80-row `LIMIT`.
2. Line ~428 (thin-feed fallback query): same change.

After the fix, the existing scoring + quota logic (MIN_TIER1_IN_TOP=5, MIN_TIER2_IN_TOP=2, MAX_TIER0_IN_TOP=3) will actually have hyperlocal candidates to choose from, and the homepage will populate with the ~180 Lake Geneva stories it's been hiding.

## Verification after fix

- Reload `/`, check console for `[GEO-TIER] Full feed: tier1=…, tier2=…, tier0=…`. Expect tier1 ≥ 5, tier2 ≥ 1, and total feed in the 20–30 range.
- Visually confirm hyperlocal stories now appear in the top of the feed.

## Follow-up (separate, ask before doing)

The Tier-2 body-completion gap (~62% missing summaries) is a real content-quality problem in the ingestion pipeline. I'd recommend a separate pass to either (a) backfill summaries from `content` / first 300 chars of the article body for affected Tier-2 rows, or (b) tighten the ingest functions so no row is saved without a summary. Not part of this fix.
