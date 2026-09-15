# Why the schedule is empty — and how to fix it

## What I found in the live data

- There are only **8 dated events** on the whole site. The soonest is **Oktoberfest, Oct 11** — 26 days out.
- The schedule box on the homepage only looks **14 days ahead**. Nothing falls inside that window, so it shows nothing at all.
- Every event source has been silent since **Aug 28**: Visit Lake Geneva Events, the city calendar, the library calendar, and the venue calendars (Studio Winery, House of Music, PIER 290, Crafted Americana, The Bottle Shop). Most stopped with the same "AI error" that killed the news feeds, one is blocked by the venue's website, and the city and library sources are switched off.
- Meanwhile 79 stories are filed as "events" and 26 as "nightlife", but they are regional news articles with no date attached (Milwaukee theater news, Fourth of July recaps), so they can never appear on a schedule.

## The fix

### 1. Never show an empty schedule (I can do this now)

When nothing falls in the next 14 days, the box falls back to the next events on the calendar under a **"Coming up"** heading instead of disappearing. Same for the "Worth a look" rail below it, which currently also gives up after 30 days.

### 2. Turn the dead event sources back on (I can do this now)

- Switch the City of Lake Geneva Calendar and Lake Geneva Public Library Events back to active so their fetchers run again.
- Point the venue scrapers that failed with "AI error" at the shared AI helper that already has the Lovable fallback, so they stop dying on the empty account.

### 3. Stop dateless news from being filed as events (I can do this now)

An "events" story with no date is a news article about something, not something to put on a calendar. Those get filed as news instead, which also stops the events category from looking full while the schedule is empty.

### 4. Still needs you

The scheduled jobs have not run since Aug 28. Until the Lovable AI key is in your project's secrets and the schedule is restarted, the sources above will stay quiet even after these fixes — the fallback in step 1 is what keeps the box useful in the meantime.

## Technical notes

- `src/components/RightRailTemporal.tsx`: keep the 14-day grouping, add a fallback query (no upper bound, `event_date >= today`, limit 6) rendered as a "Coming up" section when all three buckets are empty.
- `src/components/EditorialLaterRail.tsx`: drop the `lte(horizon)` bound on the fallback query so it degrades to the next picks rather than nothing.
- Venue/event scrapers using their own OpenAI call: route through `aiChat` in `supabase/functions/_shared/ai.ts`.
- `supabase/functions/sync-rss/index.ts`: when `aiCategory === 'events'` and `parseEventDate` returns nothing, store the story as `news`.
- Reactivating the two `sources` rows needs a migration or the admin UI — the anon key cannot update them.
