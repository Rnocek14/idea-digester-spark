
# Lake Geneva Brief → local staple: two pillars

After looking at On The Record and Perfect Duluth Day side-by-side, the reason locals open them isn't just *vibe* — it's a **two-pillar contract**:

1. **Utility** — "What's going on this week, this weekend, tonight?" (the events spine)
2. **Soul** — recurring columns, bylines, history, reader photos, an "edition" rhythm

We have most of pillar 1's *data* but none of its *surface*. We have none of pillar 2 yet. Both have to ship for the site to feel like a staple.

---

## Pillar 1 — Events as the spine ("what to look forward to")

This is the gap the user just flagged. PDD's "Event Calendar" is one of three top-nav items. On The Record's whole identity is the events listing. Right now we have `HappeningTodayWidget` and `WeekendSidebarWidget`, but no destination page that says *"here is everything coming up in Lake Geneva."*

### 1A. `/events` — the calendar destination
- Top-nav item next to "Today" and "Directory."
- Three views, toggleable: **List** (default, mobile-first), **Week**, **Month**.
- Filters: category (Music, Family, Outdoors, Dining, Civic, Arts), venue, geo-tier (Lake Geneva / Walworth County).
- Each event card: date pill, time, venue, short title, category emoji, "Add to calendar" (.ics download), share button.
- Powered entirely by existing `content_queue` rows where `event_date >= today`.

### 1B. Homepage "Coming Up" rail
- New section on `/lake-geneva` between today's brief and the latest stories.
- Three columns on desktop, horizontal scroll on mobile:
  - **Tonight** (events with `event_date = today`)
  - **This Weekend** (Fri–Sun, dynamic)
  - **Next Week** (next 7 days, top 5)
- "See all events →" link to `/events`.

### 1C. Per-event detail page `/events/[id]`
- We currently dump people to the original source URL. Bad for SEO, bad for stickiness.
- Build a real event page: title, venue, date/time, address, map embed (static), description in our voice, "Add to calendar," related events at same venue, related stories.
- This is the single biggest SEO unlock — "lake geneva [event name]" searches.

### 1D. "Plan your weekend" newsletter (Thursday 7am)
- Separate from the daily brief. Just events: tonight, Friday, Saturday, Sunday.
- Locals get one daily "what happened" + one weekly "what's coming." That cadence is what PDD/OTR readers internalize.

### 1E. Venue pages `/venues/[slug]`
- The Riviera, Baker House, Pier 290, Grand Geneva, etc. each get a page.
- Lists upcoming events at that venue + recent stories mentioning it. Drives long-tail SEO and gives sponsors a natural home page.

---

## Pillar 2 — Soul layer (from previous plan, condensed)

These are what turn "useful site" into "site I check every morning":

### 2A. Recurring columns (3 to start)
- **Throwback Thursday** — one historic photo/postcard per week (Geneva Lake Museum, Wisconsin Historical Society, public-domain postcards).
- **Mystery Monday** — "Where on the lake is this?" reader-guess column.
- **This Week on the Lake** — Monday roundup with a named voice.

Each column gets its own route (`/columns/[slug]`), its own tag in `content_queue`, its own RSS, and a fixed slot in the daily newsletter.

### 2B. Real bylines
- Add `author_slug` to `content_queue`. Civic = "Lake Geneva Brief Desk," opinion/columns = real names (start with Gina + 1-2 invited locals).
- Show byline + small avatar on every story card. Single biggest "the site feels human" lever.

### 2C. Rotating user-submitted hero photo
- Daily photo at top of `/lake-geneva`, credited to the submitter with a link.
- "Submit a photo" CTA in footer. 20 submissions = 20 days of unique-feeling homepage.

### 2D. Sponsor tiles → "Local Champions"
- Reframe sponsor block as named neighbors (square photo + name), not banners. Sells better, feels less like AdSense.

### 2E. `/submit` — one page, three buckets (photo, tip, event)
- All flow into existing tables with `safety_level='pending'` for review.
- Treats reader contributions as oxygen the way PDD does.

---

## Build sequence

### Sprint 1 — Events spine (highest leverage, ~1 week)
1. Build `/events` page with list/week/month views, filters, .ics export.
2. Add "Coming Up" rail to `/lake-geneva` homepage.
3. Add "Events" to top nav (mobile + desktop).
4. Build `/events/[id]` detail pages with map + add-to-calendar + related.

### Sprint 2 — Soul layer (~1 week)
5. Add `author_slug` + `column_slug` columns to `content_queue` (migration).
6. Build `/columns/[slug]` routes and seed Throwback Thursday with 8 weeks of public-domain Geneva Lake postcards.
7. Add byline display to `StoryCard`.
8. Build `/submit` page (photo, tip, event forms).

### Sprint 3 — Reach + rituals (~1 week)
9. Thursday "Plan your weekend" newsletter.
10. Venue pages `/venues/[slug]` for top 10 venues.
11. Rotating user-photo hero on homepage.
12. Reframe sponsor block as "Local Champions."

---

## Why this order works

- **Events first** = immediate user value + immediate SEO unlock (event pages rank for "[event name] lake geneva" within days).
- **Soul second** = compounds the events traffic into return visits and email subs.
- **Rituals third** = once we have habits to build on, we layer the weekly cadence.

This is also the order that protects the real-estate funnel: more event pages → more long-tail traffic → more sidebar exposure for Gina's listings → more leads. We don't have to choose between "useful" and "monetizable."

---

## Open questions before I start building

1. **Top nav order**: Today / **Events** / Directory / Advertise — or do you want Events to replace Directory in the main nav and push Directory into a "More" menu?
2. **Event detail pages**: build now (Sprint 1), or just deep-link to source for v1 and add detail pages in Sprint 2?
3. **Bylines on civic/auto-ingested stories**: use "Lake Geneva Brief Desk" as a neutral catch-all, or leave them unbylined and only put bylines on columns?
4. **Throwback Thursday seed**: I'll source public-domain Geneva Lake postcards myself, or do you have a Geneva Lake Museum / Historical Society contact you want to partner with first?
