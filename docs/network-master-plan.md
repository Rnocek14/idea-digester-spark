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

## 2. Technical roadmap — remaining work, in order

**Done as of this branch:** security hardening, zero-touch editorial, bootstrap
+ trial validation, multi-tenant phases 1–3 (city_id everywhere that matters,
hostname routing, scoped reader surfaces), theme system, city finder +
waitlist, trust pages, 51-test harness + CI.

**Next (mechanical, pattern established):**
- [ ] Fleet-loop `sync-spotcrime-incidents`, `sync-sheriff-releases`,
      `sync-nws-alerts`, `sync-power-outages` (copy `sync-511-traffic`'s shape;
      each has config values already; add a loop test each).
- [ ] Per-city `generate-daily-brief` + `autopilot-newsletter`: loop active
      cities, scope content queries by `city_id`, stamp inserts, and move the
      persona name + LOCAL_KW regexes onto `city_config` (gazetteer already
      there; add `theme.persona_name`).
- [ ] `sync-rss` prompt context per city: the AI system prompt embeds a Lake
      Geneva landmark dump — build it from `city_config` (gazetteer +
      signature landmarks).
- [ ] `business_stories` + remaining minor tables get `city_id` (missed in
      phase 2's 15).
- [ ] Regenerate Supabase types (removes the hand-patched city_id entries +
      `as any` casts on city_config/city_waitlist).
- [ ] Per-city serve-sitemap (loop hostnames) + per-city robots strategy once
      city #2 has a domain.

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
