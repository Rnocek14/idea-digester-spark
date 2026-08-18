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

Last updated: 2026-08-18.

---

## 1. Wire the hosting rewrites

**What it unlocks:** the six crawler-facing edge functions (real HTML for
stories/incidents, the data endpoints, per-city robots/llms, the Atom feed)
are deployed and verified working — but nothing routes the public domain to
them yet, so they receive zero traffic.

**Action:** follow [`docs/edge-serving.md`](./edge-serving.md) — it lists the
exact path → function mapping (`/robots.txt` → serve-robots, `/feed.xml` →
serve-feed, `/data/*` → serve-data, crawler HTML → serve-page, `/llms.txt` →
serve-llms).

**Verify:** `curl https://lakegenevabrief.com/robots.txt` shows a
`Sitemap:` line carrying `?city_id=`; a story URL fetched with
`curl -A GPTBot` returns readable HTML rather than an empty `<div id="root">`.

## 2. Secrets and the leftover login

**Action:** Supabase → Edge Function secrets: set `ALERT_EMAIL` (and the
Resend key if unset) so the staleness watchdog can email you instead of
logging quietly. Supabase → Authentication: delete the `devadmin@gmail.com`
user if it still exists — its hardcoded credentials were removed from the
code, but the account itself is a live login until deleted.

**Verify:** next `alert-source-health` run lands in your inbox; the user list
has no devadmin.

## 3. Send the three outreach emails (the only thing that moves Google)

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
