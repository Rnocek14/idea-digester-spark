# Lake Geneva Brief — Full Site Audit (July 2026)

> **Implementation status (2026-07-18):** The "Now" list and most of the "Next"
> presentation/IA items were implemented on this branch — edge-function auth,
> incidents RLS hardening + `report-incident` function, `developing` RLS fix,
> dev-credential removal, dead-source retirement, SpotCrime/sheriff editorial
> gating + SpotCrime cron, version-controlled daily crons, `alert-source-health`
> digest, sidebar 7-day recap, resolved-incident visibility, nav/footer IA,
> At-A-Glance dedupe, CTA density, stock-photo curbing, Today-page recency,
> Deals domain fix, sitemap RLS alignment, and dashboard code-splitting.
> Still open: prerender/SSG, editorial transparency page, city-config
> extraction, TS strict, tests, marine/Nixle/county-alert sources, and the
> operator actions listed at the end of the PR summary (ALERT_EMAIL secret,
> devadmin account check, n8n/Apify infra).

Scope: reader-facing UX, news ingestion pipeline, live incidents system, SEO,
performance, security, and multi-city templating readiness. Grounded in the
codebase, migrations, and the Lovable planning docs. (Live production data could
not be queried from the audit environment — network policy blocked supabase.co —
so volume statements come from code, cron configs, and `.lovable/plan.md`
telemetry notes.)

---

## Executive summary

**The verdict: this is a far more sophisticated build than "a website" — the
architecture, editorial design system, and safety thinking are genuinely strong.
The product's problem is not design and not ambition. It's that the content
supply chain is quietly dying, and the site's structure amplifies scarcity
instead of hiding it.** The "thin" feeling you have is accurate, and it is
diagnosable to specific dead sources, unscheduled jobs, over-aggressive filters,
and a handful of presentation choices.

Three headline facts:

1. **The live-incidents system is well-architected but almost completely
   unfed.** The only sources on cron that produce *live* rows (NWS alerts, WI
   511, power outages) are near-zero volume for a rural county. The one
   always-something source (SpotCrime) was **never scheduled**. The
   Facebook/Nixle "chatter layer" the tier engine was built for is off
   (FB deactivated 2026-05-18; the Nixle parser was never built). Two running
   scrapers (Sheriff, news backfill) insert incidents as already-`resolved`, so
   they never appear live. Result: "All Clear" forever.

2. **The news pipeline ingests broadly but publishes narrowly.** Strict
   hyperlocal geo gates, safe-only newsletter filters, a no-reuse rule, a
   3-story daily brief cap, and 72h tier-0 expiry — while the richest local
   sources (lakegenevanews.net via n8n, county/sheriff feeds, all Facebook
   sources) are inactive or depend on external infra not confirmed running.
   Worse, a scraper that returns HTTP 200 with zero items still counts as a
   *successful* fetch — one source hit **438 consecutive zero-item runs**
   (reset in migration `20260518150501`) before anyone noticed.

3. **There are security holes to close before any marketing push** — several
   admin edge functions are callable by anyone with the public anon key
   (including one that sends an email blast), and the public can insert rows
   directly into the live incidents feed.

---

## Scorecard

| Area | Grade | One-liner |
|---|---|---|
| Editorial design system | A− | Chrome rules, serif headlines, palette discipline — real publication feel |
| Ingestion architecture | B+ | Multi-layer dedupe, safety gating, source health fields — impressive |
| Content supply (actual) | D | Richest sources dead/off-cron; silent zero-run decay |
| Live incidents (actual) | D | Engine excellent, inputs ~zero; "All Clear forever" |
| Reader UX / IA | C+ | Good bones; half the site unreachable from nav; 9 CTAs per scroll |
| SEO | C− | Great guide content, but client-only SPA + static-only sitemap in repo |
| Performance | C− | Zero code-splitting; admin dashboard ships to every reader |
| Security | C | RLS mostly hardened, but unauthenticated admin functions + open incident INSERT |
| Trust / editorial identity | C+ | AI-rewrite + off-site clicks + stock photos reads aggregator-ish |
| Multi-city templatability | D− | 839 "Lake Geneva" occurrences in 92 files; no market abstraction |

---

## 1. What's genuinely good (don't lose this)

- **The editorial design system is real.** Story-card chrome rules
  (`.lovable/memory/design/story-card-chrome-rules.md`), Playfair headlines,
  lake-palette accent discipline, the brief-of-the-day pyramid, "Today's Brief"
  signed desk block, Vol/No. masthead strip. This looks like a local paper, not
  an RSS dump — a deliberate June 2026 decision that shipped.
- **The ingestion pipeline is above-market for a solo operation.** Five dedupe
  layers, hallucination detection with fail-closed safety coercion
  (`sync-rss/index.ts:2013-2019`), geo-tier gating, discovery-layer source
  rules (aggregators can never auto-publish), per-channel voice variants,
  source-health counters, kill switches in `system_settings`.
- **The incident tier engine** (`ingest-incident/index.ts`) has Tier-4
  auto-reject for arrests/overdose/suicide/juvenile content, AI rewrite that
  strips private names, multi-source confidence boosting, learned reject rules.
  This is professional-grade editorial safety design.
- **The guides library is a real SEO asset.** ~25 cornerstone guides with
  Article/Breadcrumb/FAQ JSON-LD, strong internal linking
  (`GuideShell.tsx:68-83`), llms.txt, robots.txt, three Google verifications.
- **RLS had a real hardening pass** (migration `20260518174334`): subscriber
  emails are NOT readable with the anon key; leads protected; token tables
  moved behind SECURITY DEFINER RPCs. Most projects at this stage leak PII —
  this one doesn't.
- **Revenue scaffolding exists on every side**: sponsor portal + Stripe
  checkout + invoicing, jobs board with employer magic links, deals with
  referral tracking, the Gina real-estate sponsorship integration.

---

## 2. Why the news feels thin — root causes

### 2a. Supply: the best sources are dark
- All ~30 Facebook sources deactivated (migration `20260518150501:65-77` — "No
  working FB adapter — sync-facebook-local has hardcoded source list and is not
  on cron"). That was the fire/police/schools/nightlife chatter layer.
- Walworth County + Sheriff CivicEngage sources seeded as **inactive**
  ("bot-protected — requires n8n", migration `20260205165943`).
- lakegenevanews.net (the town's paper of record) depends on an n8n Puppeteer
  VPS posting into `ingest-news` — external infra, invisible to the repo,
  single point of failure.
- City of Lake Geneva Police + Fire RSS feeds: `status='error'` since June 8
  (`.lovable/plan.md`).
- Silent decay: zero-item runs don't mark a source unhealthy enough to alert
  anyone. `handleSourceFailure` only triggers on *exceptions*
  (`sync-rss/index.ts:1237-1278`). No email/Slack alert exists for
  `consecutive_zero_runs` escalation.

### 2b. Publishing gates compound the scarcity
- Newsletter: `geo_tier IN (1,2)` AND `safety_level='safe'` AND never-reused
  (`autopilot-newsletter/index.ts:396-397`), max 5 briefing stories.
- Daily brief: max 3 stories, strict local-keyword regex AND regional-city title
  ban (`generate-daily-brief/index.ts:74-85,157-170`); "quiet day" below 2.
- Tier-0 (regional) content auto-expires after 72h
  (`auto-expire-content/index.ts:85-108`).
- The daily newsletter / daily brief / lake-beat crons are **not in migrations**
  — they exist only if hand-configured in the Supabase dashboard. A silent
  scheduler failure there is invisible in code review.

### 2c. Presentation amplifies scarcity
- Only 3–5 prominent story slots (pyramid + brief). Everything after position 3
  collapses to headline rows (`LakeGenevaV2.tsx:1280-1341`).
- The same 1–3 stories can appear in AT A GLANCE, Today's Brief, AND the hero —
  only the pyramid dedupes against the brief (`LakeGenevaV2.tsx:757-762`).
  Small news day → same story shown three times → feels thinner, not fuller.
- Most cards carry **repeated stock photos** — 3–7 fallback images per category
  chosen by hashing the story id (`StoryCard.tsx:66-138`). Two unrelated
  stories with the same "city hall" photo reads as filler.
- Every widget self-hides on empty (HappeningToday, ComingUp, RightRail,
  EditorialLater, BusinessStory, NowHiring, LakeBeat). On a quiet day the page
  collapses to: brief + history + stock-photo cards + Gina cards + subscribe
  prompts. The collapse is silent and total.
- Primary story click opens `original_url` off-site in a new tab
  (`StoryCard.tsx:174-188`); the internal permalink is a tiny gray link. The
  homepage trains readers to leave.

### 2d. Missing "always-fresh" verticals
Classic hyperlocal fills that don't depend on breaking news volume and are
absent here: real-estate transfers (county recorder), building permits, liquor
licenses, school board / city council agenda + minutes briefs, school sports
scores, obituaries, restaurant inspections, new business registrations. These
are structured data feeds — cheap to ingest, evergreen-fresh, and they template
to any city far better than scraping Facebook.

---

## 3. Why live incidents feel thin — root causes

1. **SpotCrime — the only always-something source — has no cron.** Grep of all
   migrations for `spotcrime` = 0 hits. (Do NOT just switch it on as-is: it
   inserts `status='active'`, bypassing the tier engine's PII/severity gates,
   and SpotCrime data is unverified — route it through `ingest-incident`.)
2. **The tier engine has no live feeders**: Nixle parser never built
   (`docs/nixle-backbone-setup.md:28` — "(future work)"), `sync-facebook-local`
   deactivated + off-cron, Apify config lives only in an external dashboard.
3. **Sheriff releases and the news backfill insert as `resolved`**
   (`sync-sheriff-releases/index.ts:317`, `backfill-incidents/index.ts:243`) —
   real local safety content that never appears "live."
4. **Aggressive auto-resolve**: traffic/weather ~6h; resolved items capped at 5
   on the page and excluded from the sidebar entirely.
5. **Latent RLS bug**: public read policy allows `active|monitoring|resolved`
   only (`20251202213820:38`), but the sidebar queries and the admin queue
   publishes `developing` — **a "developing" incident is invisible to the
   public**.
6. **Sidebar over-filtering**: the strict local keyword filter
   (`LiveIncidentsSidebar.tsx:50-73`) silently drops community quick-reports
   whose location is "Downtown / Main St" (no matching keyword).
7. **Missing sources for a lake town**: nothing marine (DNR/water rescue/boat
   incidents on Geneva Lake!), no county dispatch/CAD, no Broadcastify,
   Walworth County Alert Center still "TEST REQUIRED"
   (`docs/fire-department-sources.md:36-43`).
8. **Presentation**: sidebar renders nothing when empty; page shows "All Clear."
   Quiet ≠ empty — there's no "last 7 days" recap, no resolved-with-timestamps
   history view, so a normal day shows no evidence the system works at all.

---

## 4. Security — fix before promoting the site

**Critical (anyone with the public anon key can do these today):**

| Issue | Where | Impact |
|---|---|---|
| `manual-approve-stories` has no auth | `manual-approve-stories/index.ts:9-45` | Anyone can flip held/pending stories to published, bypassing editorial review |
| `cleanup-system` has no auth | `cleanup-system/index.ts:8-60` | Anyone can trigger destructive ops (expire newsletters, disable sources, `full_cleanup`) |
| `send-breaking-alert` has no auth | config.toml `verify_jwt=false`, no internal check | Anyone can send a breaking-news email blast to subscribers via Resend |
| Public INSERT on `incidents` + `incident_updates` | `20251202213820:51-58` (`WITH CHECK (true)`) | Anyone can inject fake incidents/updates rendered on public pages |

Note: `verify_jwt=true` is NOT a boundary — it is satisfied by the public anon
key shipped in the client bundle. Only `requireAdmin` (used correctly in just
2 of ~95 functions: `send-newsletter`, `bulk-approve-content`) is real.

**Important:**
- Cron scrapers (sheriff, 511, power, spotcrime) bypass the tier engine's
  PII/name-stripping entirely — sheriff release text with names goes into
  public timelines verbatim (`sync-sheriff-releases/index.ts:332-347`).
- Dev credentials committed in source (`Auth.tsx:131-180`; DEV-gated but
  committed — rotate/remove).
- `.env` is git-tracked (anon key only — publishable by design, but gitignore
  it as hygiene).
- `create-sponsor-checkout` unauthenticated + no rate limiting (abuse vector).
- `story_reactions` anon INSERT/UPDATE/DELETE `USING(true)` — vote manipulation.

---

## 5. SEO & performance

- **Client-only SPA, no SSR/prerender** (`vite.config.ts` has neither).
  Googlebot can render JS, but Twitterbot/facebookexternalhit/LinkedIn/Slack do
  not — **every story or guide shared socially previews as the generic site
  card**, not the story's headline/image. For a newsletter/social-driven local
  brand this is a real loss. Fix: prerender story + guide routes (or move to a
  framework with SSG for public routes).
- **Sitemap**: the generator (`scripts/generate-sitemap.ts`) does pull dynamic
  stories/events/incidents — good — but the committed `public/sitemap.xml` has
  only 38 static URLs, the build never fails on sitemap errors
  (`process.exit(0)`), and dynamic entries silently vanish if env vars are
  missing at build. Also its queries request `soft_sensitive` rows the anon RLS
  policy won't return. **Action: fetch lakegenevabrief.com/sitemap.xml in prod
  and verify story URLs are actually in it.**
- **Also verify crawler access**: the live site returned HTTP 403 to a plain
  server-side fetch during this audit. That may be Lovable/Cloudflare bot
  protection; confirm via Search Console URL Inspection that Googlebot fetches
  cleanly.
- **Zero code-splitting**: all ~70 pages are eager imports (`App.tsx:8-79`);
  `React.lazy` count is 0. The public homepage ships the entire admin dashboard,
  recharts, the 1,265-line dead v1 homepage, and the ImageTest QA tool. Lazy-load
  `/dashboard/*` and the v1 page for the single biggest perf win.
- **Images**: no resizing/srcset/format optimization anywhere; raw source URLs.
- **Guides**: `GuideShell` omits the site footer (loses the internal link mesh)
  and never wires the curated `seoKeywords.ts` sets.
- **IA bugs**: header "Today" nav item points to `/lake-geneva` which just
  redirects to `/` — while the actual `/today` Lake Report page is orphaned
  (nothing links to it). Two different header components (`PageShell` vs
  `PublicHeader`) give an inconsistent masthead between sections. `/incidents`,
  `/jobs`, `/deals`, `/guides`, `/nightlife` are absent from nav and footer.

---

## 6. Trust & editorial identity (product opinion)

The site's long-term value — especially as a marketing flagship for your other
apps — is **trust**, and a few current choices undercut it:

- AI-rewritten summaries + off-site clicks + repeated stock photos +
  aggregator-style attribution ("Patch.com · 3h") is structurally the content-
  farm pattern, even though your safety/quality engineering is far better than
  that. Locals can't see your pipeline — they see the surface.
- ~9 conversion surfaces per homepage scroll (4 subscribe prompts + 5+ Gina
  placements) against 3–5 real stories inverts the value exchange. The
  sponsor integration itself is fine — the density relative to content is not.
- Wrong-brand leftovers leak: `lakegeneva.news` referral URL (`Deals.tsx:166`),
  `newsletter@citybrief.info` correction email (`IncidentDetail.tsx:311`).
- No visible masthead/about/editorial-policy page explaining how stories are
  produced (AI-assisted, source-linked, corrections policy). For an
  AI-assisted local outlet in 2026, publishing that policy IS the trust play.

What earns trust instead: the signed desk voice you already built, original
data panels (By the Numbers, market report), guides, and transparent "how this
site works" copy. Double down on those.

---

## 7. Multi-city templating — honest reality check

Current state: **fork-and-find-replace, not a template.**
- 839 "Lake Geneva" occurrences across 92 files; domain hardcoded in 23 files.
- Gazetteers, venue lists, bboxes, NWS zones, agency URLs, personas, hashtags,
  and the AI system prompts are inlined per edge function (documented
  exhaustively in the pipeline/incidents audits).
- `HostnameRouter` is a stub; `subscribers.city_id` is the only DB hook.
- Your own docs already say it: "Add Multi-City Architecture… after Lake Geneva
  is proven" (`docs/civic-sources-implementation.md:139-143`). That's correct.

Recommended posture:
1. **Don't build the template now — but stop making the fork more expensive.**
   Every new feature should read city facts from one config (start a
   `city-config` module/table: bbox, keyword gazetteer, NWS zones, DOT/511
   endpoint, sheriff/PD URLs, utility map, brand domain/from-addresses,
   persona name, auto-resolve table).
2. Recognize that the **real per-city cost is source bootstrapping + ops**, not
   React code. The template product is: the city-config schema + a source
   discovery playbook + the ops runbook — the codebase is the easy 40%.
3. Prefer structurally repeatable sources (county records, permits, agendas,
   NWS, DOT, SpotCrime-class feeds) over per-city artisanal scrapers when
   choosing what to build next — they're what makes city #2 cheap.

---

## 8. Prioritized roadmap

### Now (week 1) — stop the bleeding
1. Security: add `requireAdmin` to `manual-approve-stories`, `cleanup-system`,
   `send-breaking-alert`; drop public INSERT policies on
   `incidents`/`incident_updates` (route community reports through an edge
   function with rate limiting); remove committed dev credentials.
2. Fix the `developing`-status RLS mismatch (add it to the public read policy
   or stop publishing to it).
3. Execute `.lovable/plan.md`: fix 511 parser (stop swallowing 500s), widen NWS
   zones, repair/retire the city Police/Fire RSS feeds, retire the 4 confirmed-
   dead sources, tune auto-resolve.
4. Put the daily newsletter/brief/lake-beat crons into migrations so they're
   version-controlled and can't silently vanish.
5. Add zero-run alerting: when `consecutive_zero_runs` crosses the warn
   threshold, send yourself an email via Resend. This single alert prevents the
   silent-starvation failure mode.
6. Verify in production: sitemap.xml contains story URLs; Googlebot fetch is
   clean (Search Console).

### Next (weeks 2–4) — make it feel alive
7. Incidents supply: schedule SpotCrime **through the tier engine** (not
   direct-insert); build the Nixle parser or commit to the Apify path and check
   its config into the repo; test the Walworth County Alert Center; add a
   marine/DNR source (it's a lake town); flip sheriff releases to a visible
   "Blotter/Recently reported" surface instead of silent `resolved` rows.
8. Quiet-day presentation: keep resolved incidents visible 24–48h with
   timestamps ("Resolved 3:40 PM — crash on Hwy 50 cleared"); replace the
   self-hiding sidebar with a compact "Last 7 days: 4 incidents, all resolved"
   recap. Quiet should look like *competence*, not absence.
9. Homepage: put Incidents/Jobs/Deals/Guides/Nightlife in nav + footer; fix the
   "Today" nav link; link the orphaned `/today` page; dedupe AT A GLANCE
   against the Brief/pyramid; prefer dense imageless headline rows over
   repeated stock photos; unify the two headers.
10. Reduce CTA density: one inline subscribe + the post-50%-scroll banner is
    enough; cap Gina placements per viewport.
11. Add 1–2 structured always-fresh verticals (real-estate transfers, meeting
    agenda briefs) — they carry quiet news days and template to any city.

### Later (month 2+)
12. Prerender/SSG for story + guide routes (social preview + indexing).
13. Code-split the dashboard/v1/ImageTest out of the public bundle.
14. Publish the editorial transparency page (how stories are made, corrections
    policy, AI disclosure).
15. Route ALL incident sources through the tier engine's PII gate.
16. Start the `city-config` extraction on every file you touch anyway.
17. Turn on TS `strict` incrementally; add smoke E2E tests (Playwright is
    installed and unused).

---

## Appendix: notable bugs found along the way

- `developing` incidents invisible to public (RLS policy vs sidebar/queue mismatch).
- Nav "Today" → `/lake-geneva` → redirects to `/` (double redirect, wrong target).
- `/today` page: "Top stories today" has **no date filter and no timestamps** —
  weeks-old stories can present as today's.
- Sidebar drops community reports with non-keyword locations ("Downtown / Main St").
- `WelcomeModal` only wired into the dead `/v1` homepage — if you think a welcome
  popup is running on `/`, it isn't.
- Wrong-brand URLs: `lakegeneva.news` (Deals referral), `citybrief.info`
  (corrections email, newsletter error copy).
- Weather widget failure leaves an empty bordered box in the left rail
  (`LakeGenevaV2.tsx:819`).
- Hardcoded Gina UUID duplicated in 3 files; `LAKE_GENEVA_NEWS_SOURCE_ID` UUID
  hardcoded in `ingest-news`.
- Sitemap generator requests `soft_sensitive` rows that anon RLS will never
  return.
- `scrape-incident-details` computes a severity enum that is never persisted.
- Anon JWT hardcoded inside cron migration bodies.
