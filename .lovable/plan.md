
# Plan: LLL sharpening + Community Desk

Three tracks. Track 1 ships this sprint and is small. Track 2 is the schema + editorial control we'll grow into. Track 3 is the new pillar — Community Desk — scoped so we ship a real v1, not a stub.

The governing rule we're designing toward:
**Coming Up tells you everything. Later tells you what matters. Community Desk lets Lake Geneva see itself in the site.**

---

## Track 1 — Ship now: make Later feel editorial, make Coming Up feel like utility

No schema changes. Pure presentation + a server-side dedupe.

1. **Later (inside LLL on `/lake-geneva`)**
   - Cap to 2–3 items max on homepage.
   - Heavier card treatment: larger headline, 1–2 sentence editorial blurb in our voice (not the raw summary), date pill on the left, "Why it matters" microcopy slot.
   - Pull from `content_queue` where `event_date` is 5–30 days out, prefer Tier-1 + categories Music/Civic/Arts/Festival. Sort by a simple score (geo_tier asc, then event_date asc).

2. **Coming Up rail**
   - Add a hero event card above the three buckets for the single biggest thing in the next 14 days (highest-scoring Tier-1 weekend event).
   - Dedupe: any event id that appears in Later gets either suppressed from Coming Up or rendered with a small "↑ Featured above" pill instead of a link.
   - Densify each bucket from 5 → up to 7 items, and add a tiny category filter chip row at the top of the rail (All · Music · Family · Civic · Arts · Outdoors).

3. **Voice pass**
   - Section headers reframed: Later → "What's worth looking forward to." Coming Up → "Everything on the calendar."

Files touched: `src/pages/LakeGenevaV2.tsx`, `src/components/ComingUpRail.tsx`, the existing Later component inside LLL, `src/lib/eventUtils.ts` (small helpers for scoring + dedupe set).

---

## Track 2 — Editorial control for Later (the "staple" version)

Schema + light admin UI so Later becomes genuinely curated, not just date-sorted.

1. **Migration** on `content_queue`:
   - `featured_in_later boolean default false`
   - `editorial_pick_reason text` (one-sentence "why it matters," shown on the Later card)
   - `featured_rank smallint` (1–3, controls order on homepage)
   - `featured_until date` (auto-expires the pick the day after the event)
   - Index on `(featured_in_later, featured_until)` for the homepage query.

2. **Homepage Later query** flips to: rows where `featured_in_later = true AND featured_until >= today`, ordered by `featured_rank`. Falls back to the Track-1 auto logic if fewer than 2 picks exist, so the section never goes empty.

3. **Admin surface** (small, in existing `/content-queue` dashboard):
   - "Feature in Later" toggle on each row.
   - Inline inputs for `editorial_pick_reason` and `featured_rank`.
   - A weekly AI suggestion job (reuses `generate-editorial-content` pattern) that pre-fills 3 candidate picks every Sunday for human approval — never auto-publishes.

4. **Audit + memory**: log feature/unfeature into `activity_log`; add a memory entry that Later is human-approved only.

---

## Track 3 — Community Desk (the new pillar)

A single new top-nav destination `/community` with four sub-surfaces. The point is that locals, venues, and businesses can *put themselves into the site*. This is the On The Record + PDD lesson.

### 3A. `/submit` — one page, three forms, one inbox
Tabs: **Event**, **Local Love**, **Tip / Memory**.
- All three write into existing tables with a pending status so they flow through the same moderation we already have:
  - Event → `content_queue` with `status='pending'`, `safety_level='pending'`, `submitted_by_email`, `submitter_name`.
  - Local Love → new lightweight table `community_submissions` (see schema below) with `kind='local_love'`.
  - Tip / Memory → `community_submissions` with `kind='tip'` or `kind='memory'`.
- Zod validation client + server, honeypot field, simple rate limit by IP via edge function.
- Confirmation email via Resend ("We got it. A human reads every submission.").

### 3B. `/community/local-love` — public wall
- Grid of short, approved community shout-outs (≤280 chars), each with submitter first name + town, the person/place being praised, and an optional photo.
- Three categories: People (server, teacher, coach…), Places (business, venue), Moments (event, sunset, save-the-day).
- Drives warmth and shareability; lowest-risk UGC surface.

### 3C. `/community/voices` — vetted guest posts
- New table `community_posts` (see schema). Statuses: `draft`, `submitted`, `approved`, `published`, `rejected`.
- Fixed categories: Local Opinion, Memories, Business Notes, Lake Life, Arts & Culture, Neighbor Notes.
- Real byline + small bio. Editor (admin role) approves before publish. No open-blog chaos.
- Each post gets `/voices/[slug]` with JSON-LD Article schema.
- Hooked into `content_queue` as a mirrored row at publish-time so Voices posts can appear in Latest and in the newsletter without a second pipeline.

### 3D. `/community/throwback` — local memory
- Recurring column surface. Seeded with public-domain Geneva Lake postcards + Geneva Lake Museum partnership outreach (CTA on the page).
- Same `community_posts` table with `category='memory'` and a `historical_year` field.
- Weekly "Throwback Thursday" entry feeds the newsletter and the Later rail.

### 3E. "The Brief Picks" — taste layer
- Not a new page; a tagging system on top of existing events.
- New column on `content_queue`: `pick_tag text[]` with controlled values: `worth_leaving_the_house_for`, `low_key_weekend`, `good_for_visitors`, `locals_will_care`.
- Surface as filter chips on `/events` and as a "Picks" rail on the homepage between Latest and Later.
- Manual tagging in the dashboard; AI suggestions optional later.

---

## Schema additions (Track 2 + 3 combined, one migration)

```sql
-- Track 2: editorial control for Later
ALTER TABLE public.content_queue
  ADD COLUMN featured_in_later boolean DEFAULT false,
  ADD COLUMN editorial_pick_reason text,
  ADD COLUMN featured_rank smallint,
  ADD COLUMN featured_until date,
  ADD COLUMN pick_tag text[] DEFAULT '{}',
  ADD COLUMN submitted_by_email text,
  ADD COLUMN submitter_name text;

-- Track 3: Community Desk
CREATE TABLE public.community_submissions (...);   -- local_love, tip, memory
CREATE TABLE public.community_posts (...);         -- vetted Voices + Throwback
-- + GRANTs (anon insert via edge fn only; authenticated read approved; service_role all)
-- + RLS: public reads only where status='approved' / 'published'
-- + updated_at triggers
```

Authors live in a new `community_authors` table (slug, display_name, bio, avatar_url) referenced by `community_posts.author_id`, so bylines are reusable.

---

## Build sequence

1. **This sprint**: Track 1 (presentation + dedupe). Ship, observe.
2. **Next**: Track 2 migration + admin toggles + homepage query flip.
3. **Then Track 3 in order**: schema → `/submit` (all three forms) → `/community/local-love` → `/community/voices` + authors → `/community/throwback` → Brief Picks tagging + chips.

Each Track-3 surface is independently shippable, so we can ship `/submit` + Local Love first (lowest moderation cost, fastest community signal) and let Voices follow once we have the first 3 invited contributors lined up.

---

## Open questions before I build

1. **Moderation owner**: is Gina the sole approver for Local Love + Voices for now, or do we want a second `editor` role from day one?
2. **Voices contributors at launch**: do you already have 2–3 locals in mind, or should the page launch with a "Want to write? Pitch us." CTA and no posts yet?
3. **Local Love photos**: allow optional photo upload (Supabase Storage `community-submissions` bucket) at launch, or text-only v1 to keep moderation light?
4. **Brief Picks tagging**: human-only at first (recommended), or wire the AI suggester in the same sprint?
