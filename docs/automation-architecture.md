# Automation Architecture — One Operator, Many Cities

This product is run by ONE person and is intended to be templated across many
cities. That constraint drives every design decision in this codebase. This doc
is the constitution for future work — human or AI. If a proposed feature
violates a rule here, redesign it before building it.

## The three rules

**1. Nothing ever waits for a human.**
A review queue with no reviewer is rot. Every pipeline must terminate in an
automatic decision: publish, redact-and-publish, or reject. Where judgment is
needed, encode it as deterministic rules (keyword gates, redaction templates)
or AI-with-fail-closed-defaults — never as a "pending" state a person must
clear. Backstop: anything that still lands in `pending_review` is auto-rejected
after 7 days (`auto-resolve-incidents`).

**2. Everything self-heals, and alerts are the last resort.**
The system's first response to a failure is to fix or contain it itself:
sources that die are auto-retired (`auto-maintain-sources`), stale content
auto-expires, incidents auto-resolve, crons are version-controlled so they
can't silently not-exist. Only conditions that genuinely need a human (a
structural source break worth replacing) surface in the daily
`alert-source-health` digest — and at fleet scale that digest should roll up
across cities, not multiply per city.

**3. City facts live in config, never in code.**
`city_config` (table + `_shared/cityConfig.ts` loader) is the single source of
truth for bbox, keyword gazetteers, NWS zones, agency URLs, branding, and
coordinates. Any PR that hardcodes a place name, coordinate, feed URL, or
brand string into a function is wrong — extend `city_config` instead. The
frontend should migrate onto it incrementally (it has public read RLS).

## What is fully automated today

| Concern | Mechanism |
|---|---|
| News ingestion | pg_cron → sync-rss + dedicated sync fns, AI classify, auto-publish rules |
| Incidents: traffic/weather/outages | 15-min crons, geo-filtered from city_config |
| Incidents: crime (SpotCrime) | 2h cron; Tier-3/4 material skipped deterministically, rest publishes unverified-labeled |
| Incidents: sheriff releases | 2×/day cron; Tier-4 items deterministically redacted (generic title, structured facts only) and auto-published |
| Community reports | rate-limited `report-incident` fn, unconfirmed-labeled, auto-resolve in 12h |
| Queue hygiene | pending_review auto-rejects after 7d; tier-0 content expires at 72h; auto-resolve by incident type |
| Source lifecycle | zero-run/error sources auto-retired after 30/14 days (`auto-maintain-sources`, daily cron) |
| Daily editorial | brief, lake beat, newsletter on version-controlled crons with same-day guards |
| SEO discovery | `serve-sitemap` fn generates the sitemap from the DB on request (robots.txt points to it) — no rebuild needed |
| Ops visibility | daily health digest email, only when something is actually unhealthy, max 1/20h |

## What still needs a human (and the path to zero)

| Task | Today | Path to zero-touch |
|---|---|---|
| Held news stories (`sensitive` / `no_matching_rule`) | Dashboard review | AI editor pass: classify-with-verification, auto-publish or auto-reject after 24h; same fail-closed pattern as the incident gate |
| New-city source bootstrap | Manual curation | City bootstrap job: given city/county/state, auto-generate source rows from repeatable patterns (NWS zones, state 511, SpotCrime county path, CivicPlus/CivicEngage URL probes, Google News discovery-layer, patch.com path) |
| Scraper selector breakage | Health digest → manual fix | Prefer API/RSS-pattern sources over per-site CSS scrapers; auto-retire covers the tail |
| n8n / Apify externals (Facebook, lakegenevanews) | **ELIMINATED** (see `no-vps-ingestion.md`) | lakegenevanews + CivicEngage now fetched natively via Firecrawl on cron; Facebook's coverage replaced by `ingest-email` (Nixle/listservs/press releases) — higher trust, no bot-blocking, one inbox serves the whole fleet |
| Sponsor/job approvals | Dashboard | Acceptable human task (revenue-touching, low volume); automate with payment-verified auto-approve later |

## Multi-city scaling — honest guidance

- **Per-city Supabase projects do not scale to thousands.** Each project means
  its own migrations, secrets, crons, and dashboard. At 5–10 cities it's
  tolerable; beyond that you need ONE multi-tenant database: `city_id` on
  content tables, `city_config` keyed by city, hostname-based city resolution
  (HostnameRouter is the stub for this). `city_config` was designed to make
  that transition additive, not a rewrite.
- **The template is only as scalable as its least-scalable source.** Sources
  fall into tiers: (A) structurally repeatable APIs — NWS, state DOT/511,
  SpotCrime, Google Places, patch.com, CivicPlus patterns; (B) per-city RSS
  that a bootstrap job can probe for; (C) artisanal scrapers and bot-protected
  sites needing n8n/Apify/Puppeteer. Build the template on A+B only. Every
  C-tier source added to the template is a future maintenance debt × N cities.
  **Prefer email over scraping** whenever a source offers it: Nixle, listservs,
  and press-release lists are structured, official, free, and immune to
  bot-blocking — `ingest-email` turns them into a T-A-tier source class.
- **Guides don't clone.** The ~25 Lake Geneva guides are hand-written local
  knowledge. For the template, guides need a generation pipeline (data-driven
  prose from Places/county data + AI, reviewed once at city launch) or the
  clone ships thin. Budget for this; it is the biggest per-city content cost.
- **The real product for city #2+ is the bootstrap playbook**: city_config row
  + source-pattern probes + guide generation + domain/branding. The React app
  is the easy 40%.
