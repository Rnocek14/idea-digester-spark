# The Network Master Plan — Everything We Need

The complete inventory between "Lake Geneva works" and "a network of city
Briefs that is genuinely special." Companion docs: `automation-architecture.md`
(the rules), `city-bootstrap-sop.md` (the how), `site-audit-2026-07.md` (where
we started).

## 1. What makes this special (the moat — protect these)

Patch is the cautionary tale: hundreds of cities, centralized thin content, no
soul, readers never loved it. We win on the opposite bets:

1. **The 5-minute ritual, not a feed.** One signed daily brief with a voice,
   At-a-Glance, and a page that respects the reader's time.
2. **Quiet-day competence.** Live incidents, resolved recaps, weather, data
   panels — useful every single day, even when nothing "happened." Most local
   sites are only alive when there's news; ours is alive at 6am on a quiet
   Tuesday.
3. **One signature feature per city** (Shore Path model). Hand-crafted local
   soul the template deliberately cannot generate. This is the "loved, not
   just used" ingredient.
4. **Radical transparency** (/about): we say exactly how automation + editorial
   gates work. No other AI-assisted local outlet does this; it converts the
   biggest trust liability into the differentiator.
5. **Demand-driven expansion.** The waitlist chooses the next city — every
   launch starts with subscribers already waiting.
6. **The anchor-sponsor model** (Gina pattern): one local patron "presents"
   each Brief. One sponsor ≈ covers a city's marginal cost; everything above
   (jobs, deals, secondary sponsors) is margin.

## 1b. How platform enhancements reach every city (the propagation model)

**Cities are rows, not forks.** There is exactly ONE codebase, ONE database,
ONE deploy — every city domain is served by the same build, every cron runs
the same functions. When you improve the homepage, the tier engine, or the
newsletter, every city gets it the moment the deploy lands. Nothing needs to
be copied anywhere, ever.

What keeps this true (the rules):
1. **Never fork per city.** A city-specific behavior is a `city_config` /
   `theme` field, not an if-statement on a city name and never a copied file.
2. **Schema changes ship as migrations** in `supabase/migrations/` — applied
   once, effective for all cities simultaneously.
3. **New city facts extend `city_config`** with a sane default so existing
   cities are unaffected until you set the value.
4. **CI is the gate**: every push runs the 51-test suite + typecheck + build.
   A platform enhancement that breaks the fleet never reaches the fleet.
5. **Content is city-scoped, code is shared.** `city_id` isolates data;
   everything else is intentionally global.

The one caveat: hand-written Lake Geneva guide pages (`src/pages/guides/*`)
are LG-only content, not platform — they don't propagate and shouldn't. The
guide-generation pipeline (below) is how other cities get theirs.

## 2. Technical roadmap — remaining work, in order

**Done as of this branch:** security hardening, zero-touch editorial, bootstrap
+ trial validation, multi-tenant phases 1–3 (city_id everywhere that matters,
hostname routing, scoped reader surfaces), theme system, city finder +
waitlist, trust pages, 51-test harness + CI.

**Next (mechanical, pattern established):**
- [x] Fleet-loop `sync-spotcrime-incidents` + `sync-sheriff-releases` (done;
      sheriff DocumentCenter URLs now derive from the configured press URL).
- [ ] Fleet-loop `sync-nws-alerts` + `sync-power-outages` (same shape; NWS
      zones + utility_outage_url are already in config).
- [x] `generate-daily-brief`: gazetteer-built LOCAL/REGIONAL regexes, persona
      from `theme.persona_name` (default "Maggie"), city-scoped queries,
      stamped upserts. `autopilot-newsletter`: 13 selects city-scoped + both
      inserts stamped. **Both still single-city per run** — the per-city LOOP
      lands with city #2, which also requires composite unique constraints
      `(brief_date|beat_date|edition_date, city_id)` replacing the current
      single-column uniques (city-#2 checklist item).
- [ ] `sync-rss` prompt context per city: the AI system prompt embeds a Lake
      Geneva landmark dump — build it from `city_config` (gazetteer +
      signature landmarks).
- [x] `business_stories` + `restaurant_deals` city_id (migration
      20260718180000).
- [ ] Regenerate Supabase types (removes the hand-patched city_id entries +
      `as any` casts on city_config/city_waitlist).
- [x] Per-city serve-sitemap via `?city_id=` (each city's robots.txt points at
      its own param).

**Discovery roadmap (each multiplies across all cities):** Nixle by zip · NCES
school-district lookup → feed probes · Eventbrite API by location · chamber /
library / venue iCal probes · CivicClerk/BoardDocs agenda scrapes · Granicus
patterns · verified state-511 registry expansion (one state at a time) ·
county sheriff press-page patterns · utility outage registry · real-estate
transfer / building permit / liquor license county records (the evergreen
"always fresh" verticals that carry quiet days).

**Guide generation (the biggest per-city content cost):** a `generate-city-guides`
pipeline producing draft cornerstone guides (things-to-do, moving-to, schools,
neighborhoods, FAQ) from Places data + county data + AI, reviewed once at
launch. Without it, city clones ship content-thin. Ship before city #5, not
city #2.

## 3. Per-city launch economics (the honest math)

**Marginal cost per city (steady state):** AI classification (~$5–15/mo) +
Firecrawl probes (~$5–20/mo) + email volume (Resend, scales with subscribers)
+ domain (~$12/yr). Call it **$25–50/mo per city** before email scale.

**Marginal revenue targets:** 1 anchor sponsor ($300–500/mo, the Gina slot) +
jobs/deals self-serve ($50–200/mo at maturity). **One anchor sponsor makes a
city profitable.** The sales motion — finding that sponsor — is the real
launch cost, not the tech.

**Time cost per city:** ~40-min launch pass (SOP §4) + signature feature
(hours–days, once) + anchor sponsor outreach. Everything else is zero-touch.

**Launch criteria for city #N (all must be true):**
1. Waitlist cluster or strategic pick with ≥1 warm anchor-sponsor lead
2. Bootstrap ran; ≥5 sources survived trial validation
3. Gazetteer human-checked; signature feature chosen
4. Domain connected, Resend from-address verified
5. Fleet dashboard shows Lake Geneva (and all live cities) healthy — never
   launch into an unhealthy fleet

## 4. Non-technical needs (the checklist nobody writes down)

**Legal/compliance:**
- [ ] Entity (LLC) + media liability insurance (you publish crime/incident
      info; one defamation claim outruns years of hosting costs)
- [x] Privacy policy + terms (shipped; have counsel review before scale)
- [ ] DMCA agent registration (copyright.gov) once UGC grows
- [ ] CAN-SPAM: physical mailing address in newsletter footer (verify present)
- [ ] Data deletion workflow (privacy page promises it — honor within days)

**Per-city ops (add to launch runbook):**
- [ ] Domain + DNS + Lovable custom domain
- [ ] Resend domain/from-address verification
- [ ] Google Search Console + sitemap submission
- [ ] Social handles (at minimum reserve the name)
- [ ] Google Business Profile for the outlet itself

**Measurement (build the fleet dashboard):** per city: active sources ·
stories/day (7-day avg) · % geo-tier 1–2 · trial queue age · subscribers ·
open rate · weekly returning readers. One screen, all cities, alert only on
threshold crossings. North-star metric per city: **weekly returning readers**
(newsletter opens + 7-day return visitors).

## 5. Sequence (what to do in what order)

1. **Merge PR #1** → operator checklist (devadmin, ALERT_EMAIL, sitemap
   verification, SpotCrime manual run).
2. **Prove the loop on Lake Geneva** (2–4 weeks): watch health digests, let
   incidents flow, confirm briefs/newsletters ship daily untouched. Fix what
   breaks. This is the template's QA.
3. **Bootstrap Delavan/Elkhorn as the acceptance test** (don't launch —
   grade discovery quality against ground truth you know).
4. **Finish the mechanical conversions** (§2 next-list) + fleet dashboard.
5. **City #2 for real** when a waitlist cluster or anchor-sponsor lead says
   where. Run the SOP end-to-end; measure actual time cost; fix the runbook.
6. **Cities #3–5:** guide generation pipeline + discovery roadmap tiers as
   they're needed. By #5 the marginal launch should be < 1 day of your time.
7. **Beyond:** multi-state 511/agency registries, the hub site as a real
   product (citybrief.info showcasing the network), and — the original
   thesis — the network as the distribution channel for your other apps.

## 6. Risks worth naming

- **Source rot at scale** — mitigated (self-healing + digests) but watch the
  first months of real fleet data.
- **AI content trust backlash** — mitigated by /about transparency + gates;
  never regress on labeling.
- **Legal exposure from incident coverage** — the tier gates are the control;
  never let a new source bypass `incidentGate`, and get the insurance.
- **Lovable platform coupling** — builds, hosting, and domains run through
  Lovable; an exit path (plain Vite deploy on Netlify/Vercel + Supabase as-is)
  exists and should stay tested once a year.
- **Solo-operator bus factor** — the docs in this repo ARE the mitigation;
  keep them current or the automation becomes a black box even to you.
