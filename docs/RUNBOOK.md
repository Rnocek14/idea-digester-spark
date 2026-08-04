# Operator runbook — everything that needs a human, in order

Everything the code can do, it now does. This is the complete list of what it
cannot do without you, ordered by what each unlocks. Each item says the exact
action and how to verify it worked, so "am I done?" is always answerable.
When an item is verified, delete it from this file — the runbook should shrink
to nothing and stay there.

Last updated: 2026-08-03.

---

## 1. Apply the pending migrations (biggest unlock)

**What it unlocks:** frees the paper-of-record articles stranded invisible
since the n8n removal; turns real city scoping on (currently running silently
disabled behind a fail-open fallback); creates weekly recaps, the city
waitlist, and schedules ten cron jobs — including the hourly paper-of-record
scraper, which may never have been running at all.

**Action:** Supabase Dashboard → SQL Editor → paste the whole of
[`docs/apply-pending-migrations.sql`](./apply-pending-migrations.sql) → Run.
It is idempotent — safe if some of it already applied.

**Verify:** the query at the bottom of the file returns one row; every
boolean should be `true`, and `stories_live_last_48h` is your article-count
answer. Then open `/debug/feed` on the site: "city scoping" should read
**enabled**. Next morning, the homepage's newest story should be dated today.

## 2. Schedule the market-report refresh (one small paste)

**What it unlocks:** /market-report's "updated monthly" becomes true — the
table behind it had no writer and was serving December 2024 figures.

**Action:** SQL Editor → paste
[`supabase/migrations/20260803120000_schedule_real_estate_refresh.sql`](../supabase/migrations/20260803120000_schedule_real_estate_refresh.sql)
→ Run. Then, to get fresh numbers immediately instead of waiting for the
18th: Dashboard → Edge Functions → `refresh-real-estate-metrics` → Invoke.

**Verify:** the invoke response shows `inserted ≥ 1` with a current month;
/market-report shows a current median.

## 3. Check the Lovable build log (60 seconds, decides a lot)

**What it decides:** whether the build has database access. If it doesn't,
three shipped features silently no-op: dynamic sitemap entries, story/event
prerendering, and GPX regeneration.

**Action:** open the latest Lovable build log and search for
`[sitemap] Supabase env missing`.

**Verify:** the line is absent → all three run; present → set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the build
environment and rebuild.

## 4. Wire the hosting rewrites

**What it unlocks:** the six crawler-facing edge functions (real HTML for
stories/incidents, the data endpoints, per-city robots/llms, the Atom feed)
currently receive zero traffic — they exist but nothing routes to them.

**Action:** follow [`docs/edge-serving.md`](./edge-serving.md) — it lists the
exact path → function mapping (`/robots.txt` → serve-robots, `/feed.xml` →
serve-feed, `/data/*` → serve-data, crawler HTML → serve-page, `/llms.txt` →
serve-llms).

**Verify:** `curl https://lakegenevabrief.com/robots.txt` shows a
`Sitemap:` line carrying `?city_id=`; a story URL fetched with
`curl -A GPTBot` returns readable HTML rather than an empty `<div id="root">`.

## 5. Turn on IndexNow (fast indexing where your readers actually are)

**Why it matters here:** 84 of your 95 search visits come from the Bing
index. IndexNow tells that index about new content in minutes instead of
days, automatically, for every city forever.

**Action:** SQL Editor, one statement (test first from the Functions
dashboard by invoking `submit-indexnow` with `?dry=1`):

```sql
SELECT cron.schedule('submit-indexnow-hourly', '5 * * * *', $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/submit-indexnow',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb) AS request_id; $$);
```

**Verify:** `https://lakegenevabrief.com/962496e73a4476618c0816c8d4cf5000.txt`
serves the key (it ships with the next deploy automatically); a non-dry invoke
returns `submitted: true` per city.

## 6. Secrets and the leftover login

**Action:** Supabase → Edge Function secrets: set `ALERT_EMAIL` (and the
Resend key if unset) so the staleness watchdog can email you instead of
logging quietly. Supabase → Authentication: delete the `devadmin@gmail.com`
user if it still exists — its hardcoded credentials were removed from the
code, but the account itself is a live login until deleted.

**Verify:** next `alert-source-health` run lands in your inbox; the user list
has no devadmin.

## 7. Send the three outreach emails (the only thing that moves Google)

**Why:** Bing indexes you cleanly (113 pages, 0 errors) and still sent 617
impressions in six months — that ceiling is authority, and the backlink
column reads "–". No code changes this.

**Action:** [`docs/authority-outreach-kit.md`](./authority-outreach-kit.md) —
three ready-to-send emails (library, chamber, historical society), each under
150 words, each leading with something already true. An afternoon.

**Verify:** honestly — one or two links and a relationship within a couple of
months is the realistic yield, and against an empty backlink column that is
the entire game.

---

## Weekly pulse (five minutes, after the list above is done)

- Homepage newest-story date — today means the pipeline is healthy; the
  dashboard's "Newest Live Story" card warns when it isn't.
- `docs/diagnose-news-and-readers.sql` in the SQL editor — publish volume by
  day, view→read ratio, **returning sessions** (the one bot-proof audience
  number).
- Bing Webmaster — impressions trending, excluded count falling once the
  rewrites land.
- On your phone, once: open a guide, feel the table scroll hint, check the
  header is one line. CI now guards mobile layout automatically.
