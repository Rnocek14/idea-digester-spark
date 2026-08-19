# Operator runbook — everything that needs a human, in order

Everything the code can do, it now does. This is the complete list of what it
cannot do without you, ordered by what each unlocks. Each item says the exact
action and how to verify it worked, so "am I done?" is always answerable.
When an item is verified, delete it from this file — the runbook should shrink
to nothing and stay there.

Deleted as done (2026-08-18): apply migrations, schedule the market-report
refresh, turn on IndexNow. All three now flow through
`.github/workflows/deploy-supabase.yml` — every push to main touching
`supabase/**` or the consolidated migration file re-applies SQL and redeploys
every edge function, so the database and functions follow the repo without a
human in the loop. Verified live: `city_config` seeded, publish_date backfill
0 NULLs, 38+ cron jobs listed, crawler functions serving real HTML, and a
fresh Zillow row for 53147 (median $465,610, +4.97% YoY) written today.

Also deleted (2026-08-18, later): the Lovable build-log check. Root cause
fixed in code — generate-sitemap.ts loads .env itself now (tsx never
populated process.env), and the same commit gave it serve-sitemap's
editorial filters, because the moment the generator finally ran it shipped
every tier-0 regional story into the public sitemap. 266 clean entries now.

Also deleted (2026-08-19): most of the hosting-rewrites item and all of the
secrets item. Build-time fallbacks now cover the rewrite gap on the live
domain — /feed.xml and /llms.txt are snapshotted from the deployed edge
functions at every build, robots.txt carries a second Sitemap: line pointing
at the always-fresh edge sitemap, and story pages are prerendered to real
HTML at build. The devadmin@gmail.com login is deleted by the deploy SQL.

Last updated: 2026-08-19.

---

## 1. Add ALERT_EMAIL as a GitHub secret (2 minutes)

**What it unlocks:** the staleness watchdog emails you when a source dies
instead of logging quietly.

**Action:** github.com/Rnocek14/idea-digester-spark → Settings → Secrets and
variables → Actions (the same screen SUPABASE_ACCESS_TOKEN lives on) → add
`ALERT_EMAIL` with the address you want alerts at. The next deploy forwards
it to the functions runtime automatically.

**Verify:** the next `alert-source-health` run lands in your inbox.

## 2. Send the three outreach emails (the only thing that moves Google)

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
- Bing Webmaster — impressions trending, excluded count falling now that
  the sitemap is clean and the crawler surfaces are live.
- On your phone, once: open a guide, feel the table scroll hint, check the
  header is one line. CI now guards mobile layout automatically.

Future upgrade, not a task: putting the domain behind Cloudflare's free tier
unlocks the per-request versions of everything the build now snapshots
(always-fresh feed, per-city robots, crawler HTML for stories published
between builds) — see docs/edge-serving.md. Required before city #2, optional
until then.
