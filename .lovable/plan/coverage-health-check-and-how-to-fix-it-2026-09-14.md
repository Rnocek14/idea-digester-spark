# Coverage health check — and how to fix it

## Where things stand right now (live data, last 14 days)

- **69 stories live**, but only **6 in the last 48 hours**. The site looks thin.
- **65 of those 69 came from a single source** (Lake Geneva Regional News). Everything else has gone quiet.
- **Every single story is filed as "news."** Zero events, zero community, zero dining published in two weeks.
- **Only 1 upcoming event in the next 45 days** (Oktoberfest, Oct 11). The events calendar is effectively empty.
- **Roughly 1 in 5 stories isn't local.** 15 Kenosha items, 5 Racine, plus Union Grove, Madison and Milwaukee pieces — all labeled as Lake Geneva.
- **14 of 69 are obituary roundups**, and one Kenosha story published twice.
- **Almost every source last produced around Aug 28** and hasn't since: Visit Lake Geneva Events, Fox6 Lake Geneva, Fox6 Walworth County, Walworth County Community News, Spectrum, TMJ4, plus the library, school district, city calendar and fire department feeds.

Honest read: coverage is **not fresh and not local enough**. One feed is carrying the whole site, and it's feeding in out-of-area news and obituaries.

## Plan

### 1. Find out why the feeds stopped on Aug 28
Check the scheduled jobs and the fetch logs for the quiet sources. A single date across many unrelated feeds points at the schedule or the fetcher itself, not at the publishers. Fix whatever that turns out to be, then re-run the fetchers by hand and confirm items land.

### 2. Get events flowing again
Visit Lake Geneva Events, the city calendar, the library and the venue calendars are the events backbone and all are silent. Repair the ones that can be repaired, retire the ones whose pages no longer exist, and backfill the next 60 days so the events pages and the "Later" rail have something real in them.

### 3. Stop out-of-area news being labeled local
Add a location check on the way in: a story whose town isn't in the Lake Geneva area gets pushed to the regional tier or held, instead of appearing as Lake Geneva. Re-tag the existing Kenosha and Racine items already live.

### 4. Cap obituaries and kill the duplicate
Limit obituary roundups to one visible item per day so they can't crowd the feed, and remove the repeated Kenosha story.

### 5. Make the silence loud next time
The health digest already watches for stale feeds — it clearly didn't reach anyone for two weeks. Confirm the alert email is actually configured and add a check for "one source is producing more than 80% of stories," which is the exact shape of this failure.

## Technical notes

- Sources to inspect first: `sync-rss` scheduling in `cron.job`, plus `sources.last_error_code` / `last_error_detail` for the ~10 feeds with high `consecutive_zero_runs`.
- Locality gate belongs in the ingestion classifier alongside the existing `default_geo_tier` inheritance rule, not in frontend code.
- Obituary cap and duplicate cleanup are data/ingestion changes; no UI work needed.
- `alert-source-health` needs `ALERT_EMAIL` and `RESEND_API_KEY` verified in secrets — without them it only logs to `activity_log`.
