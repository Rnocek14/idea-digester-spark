# City Bootstrap SOP — Discovering a City's Heartbeat, Accurately

How a new city goes from a name to a running local-news site, with one operator
and near-zero ongoing touch. This is both the runbook you follow and the spec
the automation implements (`bootstrap-city` → `validate-trial-sources`).

---

## 1. What "the heartbeat of a city" actually is

A hyperlocal site feels alive when it covers these beats. Every beat maps to a
source class, and every source class has a discovery strategy:

| Beat | What readers want | Source class | Discovery |
|---|---|---|---|
| Safety / "what's that siren" | incidents, closures, outages | NWS, state 511, SpotCrime, utility maps, sheriff/PD releases | fully automatic (T1) |
| Civic | council, permits, ordinances, meetings | city/county CMS (CivicPlus, CivicEngage, Granicus, Revize) | pattern probes (T2) |
| Weather / conditions | today on the lake/river/roads | NWS zones, open-meteo | fully automatic (T1) |
| News of record | the local paper(s) | WordPress-era RSS feeds | search + feed probes (T2) |
| Events | what's happening tonight/this weekend | venue iCals, chamber calendars, library, patch | probes + per-city curation |
| Schools | closures, sports, board meetings | district site RSS (NCES lookup → probe) | T2 (roadmap) |
| Business / dining | openings, closings, specials | Google Places import + review scrapes | semi-automatic |
| Community chatter | the Facebook layer | Apify/n8n scrapers | **excluded from template** (C-tier, doesn't scale) |

The template ships beats 1–4 fully automated, 5–7 partially. Beat 8 is a
per-city luxury, never a template dependency.

## 2. The accuracy model (the core idea)

**Discovery is never trusted. Only observed behavior is trusted.**

A search result claiming "this is the Delavan paper's RSS feed" is a guess.
Feeds lie, move, go stale, or serve a parked domain. So no discovered source
can publish content directly:

```
candidate ──probe ok──▶ trial ──2 daily fetches each returning ≥1 real item──▶ active/ready
                          │
                          └──5 consecutive failed fetches──▶ inactive (auto-retired)
```

- `bootstrap-city` inserts everything it finds as `trial` (or `candidate` for
  scrape-types needing adaptation).
- `validate-trial-sources` (daily cron) fetches every trial source, counts real
  `<item>`/`<entry>` elements, and promotes/demotes on evidence. Nobody reviews
  a list of URLs; the fleet grades itself.
- Promotion goes to `active` only for the live city; other cities park at
  `ready` until they launch (their content must not leak into the live feed
  before content tables are city-scoped).
- After promotion, the existing runtime health machinery takes over
  (zero-run counters → `alert-source-health` → `auto-maintain-sources`).

**Content-level accuracy stacks on top** (already built):
- Aggregators (Google News) are `discovery_layer` — they can never auto-publish
  (see `.lovable/memory/strategy/discovery-layer-sources.md`).
- Geo gates: bbox + per-city gazetteer from `city_config`.
- Safety gates: the Tier-4/Tier-3 keyword engine (`_shared/incidentGate.ts`),
  deterministic redaction for official releases, hallucination checks in
  `sync-rss`, fail-closed safety classification.

## 3. Discovery tiers (what `bootstrap-city` does)

Input: `{city_name, state_code, county_name, site_domain?, lat/lon?}` — that's
the entire per-city seed.

**T1 — Deterministic (config computed, no discovery risk):**
- Geocode via open-meteo (no key).
- NWS forecast + county zones computed from `api.weather.gov/points/{lat},{lon}`.
- Bbox from center + radius.
- SpotCrime county path; state 511 API from the verified-state registry.
- Google News RSS query feed (discovery-layer, trust-capped).
- patch.com presence probe.

**T2 — Pattern probes (guessing where things usually live, then verifying):**
- City .gov base URL candidates → CivicPlus `/CivicAlerts.aspx?Format=RSS` probe.
- Firecrawl search "{city} {state} local news" → candidate domains (national
  domains blocklisted) → WordPress feed-path probes (`/feed/`, `/rss`, ...).
- A probe only counts if the response parses as a feed with ≥1 item — and even
  then it only earns `trial`.

**T3 — AI-assisted (fail-open):**
- Gazetteer expansion: GPT lists real places/lakes/highways in the county plus
  nearby metros for the exclusion list; deterministic base (city, county) is
  the floor if AI is unavailable or wrong.

**Roadmap tiers (add as verified, each ×N cities of value):**
- Nixle by zip; NCES → school district feeds; chamber/visitor-bureau calendars;
  Eventbrite API by location; CivicClerk/BoardDocs agenda scrapes; Granicus
  pattern probes; more state 511 registries (verify endpoint shape per state);
  county sheriff press-page patterns; utility outage map registry.

## 4. Per-city launch runbook

**Automatic (minutes):**
1. `POST /functions/v1/bootstrap-city` (admin token) with the city seed.
2. Read the returned report (also stored in `source_discovery_runs`).
3. Wait 2–3 days while `validate-trial-sources` grades the trial sources.

**The one irreducible human pass (~30–45 min, once per city):**
4. Gazetteer sanity check: read `city_config.local_keywords` — delete anything
   that isn't a real nearby place (AI expansion is fail-open, not infallible;
   a wrong keyword mis-geo-tags content forever).
5. Spot-check promoted sources: open each `ready`/`active` source URL once —
   is it actually the local paper, or an SEO farm that happens to have a feed?
   Kill fakes (`status='inactive'`, `metadata.retired_reason='human: not legit'`).
6. Domain + branding: connect the domain, confirm `city_config` branding row,
   verify Resend from-address domain.
7. Flip `city_config.status` to `active`.

Steps 4–5 are the accuracy backstop AI can't fully replace: legitimacy judgment.
Budget them; never skip them. Everything after launch is zero-touch.

## 5. The Supabase solution (multi-tenant plan)

**Decision: one Supabase project for the whole fleet.** Per-city projects mean
per-city migrations, secrets, crons, and dashboards — dead at 10 cities,
unthinkable at 1,000.

**Phase 1 — done (migration `20260718140000`):**
- `city_config` = city registry (id = slug, hostname, status, all city facts).
- `sources.city_id` — the first tenant column; everything defaults to
  `'default'` (Lake Geneva) with zero behavior change.
- `source_discovery_runs` log; trial-validation cron.

**Phase 2 — before any second city serves traffic:**
- Add `city_id` (default `'default'`) to content tables: `content_queue`,
  `incidents`, `incident_updates`, `daily_briefs`, `newsletters`, `subscribers`
  (already has nullable `city_id`), `lake_beats`, `business_profiles`,
  `job_listings`, `restaurant_*`, `community_*`, `evergreen_content`,
  `history_entries`, `ad_placements`, `sponsors`.
- Ingest functions stamp `city_id` from the source row; sync functions loop
  `for each active city in city_config` instead of running once.
- Composite indexes `(city_id, status, publish_date)` on hot query paths.
- RLS: public-content policies gain no city filter (content is public);
  city scoping is a query-correctness concern, not a security boundary.
  Subscriber/lead PII policies stay admin-only as today.

**Phase 3 — serving:**
- `HostnameRouter` resolves hostname → `city_config` row (it already stubs
  this); all frontend queries add `.eq('city_id', city.id)`; `PageMeta`/JSON-LD/
  sitemap read branding from config. One deploy serves every domain (Lovable
  supports multiple custom domains → same app).
- Per-city crons become fleet crons: one cron iterates active cities.

**Phase 4 — scale valves (only when hit):**
- DB partitioning by `city_id` on content tables at ~10M rows.
- Read replicas / regional projects at ~100+ high-traffic cities.
- Edge-function fan-out queue (one worker per city per sync tick) when a
  single invocation can't cover the fleet within its time budget.

**Cost note:** marginal infra cost per city ≈ AI classification + Firecrawl
probes + email volume. The fixed costs (project, crons, code) do not multiply.

## 6. What accuracy means at fleet scale — the dashboard numbers that matter

Watch exactly four numbers per city (all derivable from existing tables):
1. **Active sources** (< 5 = the city is starving; bootstrap more patterns)
2. **Stories published / day** (7-day avg; < 3 = thin, check source health)
3. **% content geo-tier 1–2** (< 60% = gazetteer too loose, leaking regional)
4. **Trial queue age** (> 14 days = discovery found junk; re-run bootstrap)

A fleet health rollup = these four numbers × N cities on one screen, alerts
only on threshold crossings. Never per-city daily emails.
