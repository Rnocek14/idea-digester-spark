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

## 3. Verify the welcome email can actually fire (5 minutes)

**What it unlocks:** the one-time welcome email to every new subscriber. The
`trigger_send_welcome_email` trigger posts to the `send-welcome-email` edge
function using the service-role key from a database GUC. If that GUC was never
set, the trigger logs a WARNING and skips — signups still succeed, they just
stay silent, exactly as before.

**Action:** SQL editor →
`SELECT current_setting('app.settings.service_role_key', true) IS NOT NULL AS ok;`
If that reads false, set it once (Settings → API → service_role key):
`ALTER DATABASE postgres SET app.settings.service_role_key = '<key>';`
Same GUC `notify-tier-up` already depends on, so a false here means tier-up
emails have never fired either.

**Verify:** subscribe with a throwaway address, then
`SELECT email, welcome_sent_at FROM subscribers ORDER BY subscribed_at DESC LIMIT 1;`
— `welcome_sent_at` stamped means it sent.

## 4. Decide the one sending domain (30 minutes, mostly DNS)

**Why:** the publication answers to four names. The site is
`lakegenevabrief.com`, newsletter mail leaves from `newsletter@citybrief.info`,
and two functions still send from a third domain. In a town where the whole
product is trust, that reads as four outfits; to Gmail, a From-domain that does
not match the site is a weaker signal than one that does.

**Already done in code:** every reader-facing link and every masthead now comes
from `city_config` (`site_domain`, `site_name`, `from_email`), so changing the
row changes the newsletter, the unsubscribe page and the welcome email at once.
No redeploy needed for a name or domain change.

**Action (yours, because it needs DNS and a Resend decision):**
1. Pick the one domain. `lakegenevabrief.com` is the canonical site and the
   cheapest choice — everything already points there.
2. Verify it in Resend (resend.com/domains) and update the `city_config` row:
   `UPDATE city_config SET from_email = 'newsletter@<domain>',
    breaking_from_email = 'breaking@<domain>' WHERE id = '<city id>';`
3. Two From addresses are still hardcoded because repointing them at an
   unverified mailbox would silently break those sends — change them once the
   domain above is verified:
   `supabase/functions/notify-expiring-jobs/index.ts` (`jobs@lakegeneva.news`)
   and `supabase/functions/notify-tier-up/index.ts` (`hello@lakegeneva.news`,
   which also signs itself "Lake Geneva News" — a fourth name).
4. Set `APP_BASE_URL` in the functions runtime to the chosen origin. Unset is
   now safe (it falls back to the canonical site), but explicit is better.

**Verify:** send yourself a test issue. The From domain, every link, and the
masthead should all name the same publication, and the mail client should show
its own one-click Unsubscribe button next to the sender.

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
