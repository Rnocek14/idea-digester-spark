---
name: Locality Evidence Rule
description: Only the headline proves locality — AI summaries always name-drop Lake Geneva and must never set geo_tier
type: feature
---
Locality (`geo_tier` / `geo_label`) is decided from the **story title only**, never the AI summary.

**Why:** the ingestion summarizer is instructed to make local relevance explicit, so almost every summary it writes contains "Lake Geneva". Feeding that text into keyword-based locality detection filed 23 Kenosha and 10 Racine stories as tier-1 Lake Geneva news.

**Rules:**
- `isNonLocalStory` (sync-rss) checks local keywords in the TITLE only.
- The non-local check runs BEFORE `detectLocality`; a non-local headline is capped at tier 0 regardless of summary text.
- `retag-nonlocal` edge function re-applies the same rule to already-published rows (admin-only; triggered from Pipeline Health → "Fix out-of-area labels"). The anon key cannot update `content_queue`.

**Related:** obituary items are capped at 1 auto-published per day in sync-rss (`hold_reason = 'obituary_daily_cap'`); the rest are held for review.
