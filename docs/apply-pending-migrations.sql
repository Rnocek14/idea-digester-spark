-- ============================================================================
-- APPLY-PENDING-MIGRATIONS — one paste, safe to re-run.
--
-- Everything the codebase expects the database to have that may not be applied
-- in production, in timestamp order. Sources: the thirteen files under
-- supabase/migrations/ from 20260718120000 through 20260731120000, taken
-- verbatim from origin/main and made idempotent (IF NOT EXISTS guards and
-- DROP-before-CREATE for policies/triggers), so running this against a
-- database that already has some of it is harmless.
--
-- HOW TO RUN: normally you don't — .github/workflows/deploy-supabase.yml runs
-- this file through the Management API on every push to main touching it.
-- Manual fallback: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Then check the verification block at the bottom, and /debug/feed on the site
-- (city scoping should read "enabled").
-- ============================================================================

-- Scheduling below uses pg_cron + pg_net. Both are no-ops if already enabled;
-- if the project never had them, this is what turns scheduling on at all.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ===== 20260718120000_harden_incidents_rls.sql ===============================
-- Harden incidents RLS.
-- 1) Drop the open INSERT policies: anyone with the anon key could insert rows
--    directly into the public live-incidents feed. Community quick reports now go
--    through the rate-limited `report-incident` edge function (service role), and
--    all pipeline functions already use the service role, which bypasses RLS.
DROP POLICY IF EXISTS "System can insert incidents" ON public.incidents;
DROP POLICY IF EXISTS "System can insert incident updates" ON public.incident_updates;

-- 2) Include 'developing' in the public read policy. The incidents queue publishes
--    to this status and LiveIncidentsSidebar queries it, but anon readers could not
--    see it — a "developing" incident was invisible to the public.
DROP POLICY IF EXISTS "Public can view active incidents" ON public.incidents;
CREATE POLICY "Public can view active incidents" ON public.incidents
  FOR SELECT USING (status IN ('active', 'developing', 'monitoring', 'resolved'));

-- ===== 20260718121000_retire_dead_sources.sql ================================
-- Retire confirmed-dead sources so they stop wasting fetch budget and polluting
-- Source Health (per .lovable/plan.md). Uses status='inactive' (the established
-- status value) plus a metadata marker, and only touches rows that are currently
-- active or error so nothing already-disabled is resurrected.

-- 1) Long-term zero-run sources: Fontana Village Alerts (1,582 zero runs),
--    Google News – Walworth County (dup of Walworth County Community News),
--    TMJ4 Walworth County (feed empty upstream), Spectrum News Wisconsin - Weather
--    (2,021 zero runs).
UPDATE public.sources
SET status = 'inactive',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'retired', true,
      'retired_reason', 'confirmed dead upstream / persistent zero-item runs',
      'retired_at', '2026-07-18'
    )
WHERE status IN ('active', 'error')
  AND (
    name = 'Fontana Village Alerts'
    OR name ILIKE 'Google News%Walworth%'
    OR name = 'TMJ4 Walworth County'
    OR name = 'Spectrum News Wisconsin - Weather'
  );

-- 2) City of Lake Geneva Police/Fire legacy CivicEngage RSS endpoints
--    (RSSFeed.aspx pattern, erroring since 2026-06-08). Matched by URL so all
--    name variants are covered.
UPDATE public.sources
SET status = 'inactive',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'retired', true,
      'retired_reason', 'legacy CivicEngage RSSFeed.aspx endpoint dead since 2026-06-08',
      'retired_at', '2026-07-18'
    )
WHERE status IN ('active', 'error')
  AND url ILIKE '%cityoflakegeneva.gov/RSSFeed.aspx%';

-- ===== 20260718122000_schedule_incident_and_daily_crons.sql ==================
-- Version-control the daily editorial crons and schedule the missing incident
-- source. Previously generate-daily-brief / generate-lake-beat / the daily
-- newsletter existed only as hand-configured dashboard crons (a silent failure
-- there was invisible in code review), and sync-spotcrime-incidents was deployed
-- but never scheduled at all.
--
-- cron.schedule() upserts by job name. autopilot-newsletter has a same-day guard
-- ("newsletter already exists for today"), so a duplicate dashboard cron firing
-- alongside these is a no-op.

-- SpotCrime (now routed through the shared editorial gate): every 2 hours.
SELECT cron.schedule(
  'sync-spotcrime-every-2h',
  '15 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-spotcrime-incidents',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Daily brief (Maggie) at 5:30am CT — must run before the newsletter, which
-- embeds today's brief.
SELECT cron.schedule(
  'generate-daily-brief-morning',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-daily-brief',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Lake beat line at 5:45am CT.
SELECT cron.schedule(
  'generate-lake-beat-morning',
  '45 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-lake-beat',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Daily newsletter at 7:30am CT (after full-queue-prep at 12:00 UTC).
SELECT cron.schedule(
  'autopilot-newsletter-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/autopilot-newsletter',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Source-health digest at 6:00am CT (requires ALERT_EMAIL secret; no-ops otherwise).
SELECT cron.schedule(
  'alert-source-health-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/alert-source-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== 20260718130000_city_config.sql ========================================
-- city_config: single source of truth for every city-specific fact that was
-- previously hardcoded across edge functions (bboxes, keyword gazetteers, NWS
-- zones, agency URLs, branding). This is the template foundation: cloning the
-- product to a new city becomes "insert a row", not "find/replace 92 files".
--
-- Single-city deployments hold one row (id='default'). If the fleet later
-- moves to a multi-tenant database, this table gains a city_id and the loader
-- keys off hostname — the shape is forward-compatible.

CREATE TABLE IF NOT EXISTS public.city_config (
  id text PRIMARY KEY DEFAULT 'default',
  city_name text NOT NULL,
  state_code text NOT NULL,
  county_name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  -- {minLat, maxLat, minLon, maxLon}
  bbox jsonb NOT NULL,
  -- Positive gazetteer: any of these in title/location marks content local.
  local_keywords text[] NOT NULL DEFAULT '{}',
  -- Negative gazetteer: any of these marks content non-local (big nearby metros).
  non_local_keywords text[] NOT NULL DEFAULT '{}',
  nws_zones text[] NOT NULL DEFAULT '{}',
  state_511_api_base text,
  spotcrime_path text,
  sheriff_press_url text,
  utility_outage_url text,
  site_domain text NOT NULL,
  site_name text NOT NULL,
  from_email text NOT NULL,
  breaking_from_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.city_config ENABLE ROW LEVEL SECURITY;

-- Config is non-sensitive (all values already ship in the client bundle today);
-- public read lets the frontend adopt it incrementally.
DROP POLICY IF EXISTS "Public can read city config" ON public.city_config;
CREATE POLICY "Public can read city config" ON public.city_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage city config" ON public.city_config;
CREATE POLICY "Admins can manage city config" ON public.city_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed: Lake Geneva, WI (values consolidated from the previously-hardcoded
-- constants in ingest-incident, sync-511-traffic, sync-spotcrime-incidents,
-- sync-nws-alerts, and LiveIncidentsSidebar).
INSERT INTO public.city_config (
  id, city_name, state_code, county_name, timezone, latitude, longitude, bbox,
  local_keywords, non_local_keywords, nws_zones, state_511_api_base,
  spotcrime_path, sheriff_press_url, utility_outage_url,
  site_domain, site_name, from_email, breaking_from_email
) VALUES (
  'default',
  'Lake Geneva',
  'WI',
  'Walworth County',
  'America/Chicago',
  42.5917,
  -88.4334,
  '{"minLat": 42.4953, "maxLat": 42.8421, "minLon": -88.7773, "maxLon": -88.2891}'::jsonb,
  ARRAY[
    'lake geneva','geneva lake','walworth','williams bay','fontana','elkhorn',
    'delavan','genoa city','bloomfield','town of linn','lake como','como',
    'powers lake','darien','east troy','sharon','burlington','whitewater',
    'pell lake','twin lakes','lyons','abbey resort','grand geneva',
    'big foot beach','wrigley drive','hwy 50','hwy 12','highway 50','highway 12',
    'flat iron park','library park','horticultural hall','riviera','pier 290',
    'baker house','gordy','harpoon willie','fat cat','geneva tap house',
    'topsy turvy','house of music','crafted americana','chuck''s lakeshore','badger high',
    'us-12','highway 67','hwy 67','highway 120','hwy 120','i-43','interstate 43'
  ],
  ARRAY[
    'milwaukee','kenosha','racine','madison','waukesha','janesville','beloit',
    'chicago','rockford','green bay','brookfield','wauwatosa','minneapolis',
    'minnesota','illinois','indiana','iowa','michigan'
  ],
  ARRAY['WIZ063','WIZ062','WIZ057'],
  'https://511wi.gov/api',
  'WI/Walworth%20County',
  'https://www.co.walworth.wi.us/747/News-Releases',
  NULL,
  'lakegenevabrief.com',
  'Lake Geneva Brief',
  'newsletter@citybrief.info',
  'breaking@citybrief.info'
) ON CONFLICT (id) DO NOTHING;

-- ===== 20260718131000_schedule_auto_maintenance.sql ==========================
-- Self-healing source maintenance: daily at 4:30am CT. Auto-retires long-dead
-- sources and expires stale newsletters — cleanup that previously required a
-- human in the dashboard. Zero-touch fleet hygiene.
SELECT cron.schedule(
  'auto-maintain-sources-daily',
  '30 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/auto-maintain-sources',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== 20260718140000_multi_city_foundation.sql ==============================
-- Multi-city foundation, phase 1 of the multi-tenant rollout.
--
-- Decision (see docs/automation-architecture.md + docs/city-bootstrap-sop.md):
-- ONE Supabase project serves all cities. city_config becomes the city
-- registry (one row per city, id = city slug), and city_id columns roll out
-- table-by-table, starting with sources here. Content tables (content_queue,
-- incidents, events...) get city_id in phase 2, before any second city goes
-- live. Hostname-based city resolution lands in HostnameRouter at the same
-- time. Until then, everything continues to run as the 'default' city with
-- zero behavior change.

-- 1) city_config becomes the city registry.
ALTER TABLE public.city_config
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.city_config.status IS
  'active = serving traffic; bootstrapping = sources in trial, not serving';

CREATE UNIQUE INDEX IF NOT EXISTS uq_city_config_hostname
  ON public.city_config (hostname) WHERE hostname IS NOT NULL;

UPDATE public.city_config SET hostname = site_domain WHERE id = 'default' AND hostname IS NULL;

-- 2) sources gains city_id — the first multi-tenant column. Existing rows
--    backfill to 'default' via the column default.
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT 'default'
  REFERENCES public.city_config(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sources_city_status ON public.sources (city_id, status);

-- 3) Source lifecycle statuses for the discovery pipeline:
--    candidate  -> discovered, not yet probed
--    trial      -> probe succeeded once; being validated by repeated fetches
--    ready      -> validated, city not yet live (non-default cities park here)
--    active     -> live (fetched by sync-rss and the sync crons)
--    inactive/error/retired -> as today
-- No schema change needed (status is unconstrained text); documented here for
-- the record. sync-rss fetches only status='active', so new states are inert.

-- 4) Discovery run log: every bootstrap-city invocation writes a full report.
CREATE TABLE IF NOT EXISTS public.source_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES public.city_config(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.source_discovery_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view discovery runs" ON public.source_discovery_runs;
CREATE POLICY "Admins can view discovery runs" ON public.source_discovery_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 5) Trial validation cron: fetches every trial source daily, promotes after
--    repeated success, demotes after repeated failure. Zero-touch grading.
SELECT cron.schedule(
  'validate-trial-sources-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/validate-trial-sources',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== 20260718150000_multi_city_phase2.sql ==================================
-- Multi-city phase 2: city_id on content tables.
--
-- Every row defaults to 'default' (Lake Geneva), so this is a zero-behavior
-- change for the live site. It makes it POSSIBLE for a second city's content
-- to coexist without leaking into the first city's surfaces — the precondition
-- for activating any bootstrapped city (see docs/city-bootstrap-sop.md §5).
--
-- Frontend/serving queries adopt .eq('city_id', ...) in phase 3 (hostname
-- routing). Until then a single live city means unfiltered queries stay
-- correct because everything IS 'default'.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_queue',
    'incidents',
    'daily_briefs',
    'newsletters',
    'lake_beats',
    'job_listings',
    'business_profiles',
    'evergreen_content',
    'history_entries',
    'community_posts',
    'community_submissions',
    'restaurants',
    'restaurant_news',
    'sponsors',
    'ad_placements'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT ''default'' REFERENCES public.city_config(id)',
      t
    );
  END LOOP;
END $$;

-- Hot-path composite indexes (the two tables queried on every page load).
CREATE INDEX IF NOT EXISTS idx_content_queue_city_status_publish
  ON public.content_queue (city_id, status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_city_status_updated
  ON public.incidents (city_id, status, updated_at DESC);

-- subscribers.city_id normalization — TYPE-AWARE, because the live column
-- diverged from the repo's migration history: production has it as uuid
-- (from an early Lovable-era schema), not the nullable text the git-side
-- migrations assumed. First deploy run failed exactly here (22P02: invalid
-- input syntax for type uuid: "default"). Only normalize when the column is
-- actually text; a uuid column keeps its NULL-means-Lake-Geneva semantics
-- untouched (nothing in the app writes or filters subscribers.city_id, so
-- there is no behavior to preserve — reconcile via reporting if ever needed).
DO $$
DECLARE
  coltype text;
BEGIN
  SELECT data_type INTO coltype
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'subscribers'
     AND column_name = 'city_id';
  IF coltype IN ('text', 'character varying') THEN
    UPDATE public.subscribers SET city_id = 'default' WHERE city_id IS NULL;
    ALTER TABLE public.subscribers ALTER COLUMN city_id SET DEFAULT 'default';
  ELSE
    RAISE NOTICE 'subscribers.city_id is % — skipping text normalization', coltype;
  END IF;
END $$;

-- ===== 20260718160000_city_theme.sql =========================================
-- Per-city theme/identity. Config values make a city site FUNCTION; the theme
-- makes it feel like ITS place — Lake Geneva works because of the lake palette,
-- the wave line, the Shore Path motif, Streblow boats. Every city gets the same
-- slots, filled with its own identity. Anything not set falls back to the Lake
-- Geneva defaults in src/lib/cityTheme.ts, so first paint never flashes.
--
-- Schema (all optional):
--   tagline        masthead kicker ("Local Edition")
--   region_line    top-strip geography line
--   footer_kicker  footer motto ("From the Shore Path")
--   editor_note    signed footer note
--   motif          'lake' | 'river' | 'coast' | 'downtown' | 'none'
--                  (controls the animated water line + signature art slots)
--   palette        CSS custom-property values (HSL triplets) for the accent
--                  tokens in src/index.css: lake-light, lake-blue, lake-deep,
--                  lake-navy, shore-terracotta, lake-sand
--   signature      { feature_name, landmarks[] } — the hand-crafted local
--                  hooks (Shore Path / Streblow-class content) that guides and
--                  editorial features build on

ALTER TABLE public.city_config
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.city_config
SET theme = '{
  "tagline": "Local Edition",
  "region_line": "Geneva Lake · Walworth County, Wisconsin",
  "footer_kicker": "From the Shore Path",
  "editor_note": "Curated from the shore path by Gina Nocek — a daily note for the people who call Geneva Lake home.",
  "motif": "lake",
  "palette": {
    "lake-light": "200 80% 82%",
    "lake-blue": "205 65% 68%",
    "lake-deep": "205 55% 38%",
    "lake-navy": "215 70% 35%",
    "shore-terracotta": "25 75% 42%",
    "lake-sand": "45 30% 96%"
  },
  "signature": {
    "feature_name": "Shore Path",
    "landmarks": ["Yerkes Observatory", "Big Foot Beach", "Riviera Pier", "Streblow boats"]
  }
}'::jsonb
WHERE id = 'default' AND theme = '{}'::jsonb;

-- ===== 20260718170000_city_waitlist.sql ======================================
-- city_waitlist: demand capture for cities we haven't launched yet.
-- When the city finder (geolocation / zip) can't match a visitor to a live
-- city, they can leave an email + zip. Each row is a market signal: the
-- expansion roadmap is "sort waitlist by zip cluster, launch where demand is."

CREATE TABLE IF NOT EXISTS public.city_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  zip text,
  lat double precision,
  lon double precision,
  place_label text,
  nearest_city_id text,
  distance_km double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One signup per email+zip; repeat submissions are silent no-ops client-side.
CREATE UNIQUE INDEX IF NOT EXISTS uq_city_waitlist_email_zip
  ON public.city_waitlist (lower(email), COALESCE(zip, ''));

ALTER TABLE public.city_waitlist ENABLE ROW LEVEL SECURITY;

-- Same pattern as subscribers: the public can sign up, only admins can read.
DROP POLICY IF EXISTS "Anyone can join the city waitlist" ON public.city_waitlist;
CREATE POLICY "Anyone can join the city waitlist" ON public.city_waitlist
  FOR INSERT WITH CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255
  );

DROP POLICY IF EXISTS "Admins can view the city waitlist" ON public.city_waitlist;
CREATE POLICY "Admins can view the city waitlist" ON public.city_waitlist
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260718180000_city_id_stragglers.sql =================================
-- Straggler tables from the phase-2 city_id rollout.
ALTER TABLE public.business_stories
  ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id);
ALTER TABLE public.restaurant_deals
  ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id);

-- ===== 20260718190000_remove_n8n_dependencies.sql ============================
-- Remove the n8n/VPS dependency from ingestion.
--
-- Three jobs were outsourced to an external n8n VPS. Two have native
-- replacements that already exist in this repo but were never scheduled; the
-- third (Facebook) is replaced by email ingestion rather than scraping.
--
--   1. lakegenevanews.net Puppeteer  -> scrape-lakegenevanews (Firecrawl), cron below
--   2. County/Sheriff CivicEngage    -> sync-rss's Firecrawl fallback for type='scrape'
--   3. Facebook page scraping        -> ingest-email (Nixle / listservs / press releases)
--
-- Nothing here depends on a machine you have to keep alive.

-- 1) Paper of record via Firecrawl, hourly. The function is idempotent
--    (normalized_url dedupe in ingest-news) so overlapping runs are harmless.
SELECT cron.schedule(
  'scrape-lakegenevanews-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/scrape-lakegenevanews',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2) Email ingestion every 10 minutes (no-ops until Gmail creds are set).
SELECT cron.schedule(
  'ingest-email-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) Reactivate the Cloudflare-protected county sources as scrape-type so
--    sync-rss fetches them through its Firecrawl fallback instead of waiting
--    on an n8n webhook that was never built. If Firecrawl can't get through
--    either, the zero-run health counters + auto-maintain-sources will retire
--    them automatically — no human follow-up required.
UPDATE public.sources
SET status = 'active',
    type = 'scrape',
    metadata = COALESCE(metadata, '{}'::jsonb)
      - 'requires_n8n'
      - 'setup_required'
      || jsonb_build_object(
        'ingestion_method', 'firecrawl',
        'requires_browser', true,
        'reactivated_at', '2026-07-18',
        'note', 'Cloudflare-protected; fetched via sync-rss Firecrawl fallback'
      )
WHERE status = 'inactive'
  AND (
    metadata->>'ingestion_method' = 'n8n_webhook'
    OR metadata->>'requires_n8n' = 'true'
  );

-- 4) Email source bindings. A sources row with metadata.email_from binds a
--    sender address to a city; ingest-email ignores every unknown sender.
--    Seeded inactive: activate each one as you subscribe the inbox to it.
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, city_id, metadata)
VALUES
  (
    'Nixle – Walworth County (email)',
    'api',
    'mailto:nixle-walworth',
    'safety',
    'inactive',
    10,
    1,
    'default',
    '{"email_from": "alerts@nixle.com", "email_source_type": "nixle", "trusted_source": true, "note": "Subscribe the ingest inbox at nixle.com with the city ZIP, then set status=active"}'::jsonb
  ),
  (
    'City of Lake Geneva – notifications (email)',
    'api',
    'mailto:lakegeneva-city-notify',
    'civic',
    'inactive',
    10,
    1,
    'default',
    '{"email_from": "noreply@cityoflakegeneva.gov", "email_source_type": "official", "trusted_source": true, "note": "Subscribe the ingest inbox to the city notification list, then set status=active"}'::jsonb
  )
ON CONFLICT (url) DO NOTHING;

-- ===== 20260718200000_weekly_recaps.sql ======================================
-- weekly_recaps: the Sunday "your week in {city}" edition.
--
-- Why this exists: six stories spread across seven days reads as thin; the
-- same six framed as a week-in-review reads as a publication with a rhythm.
-- It's also the lowest-risk AI content we publish — purely derivative of
-- stories we already ingested, gated, and published, so there are no new
-- factual claims to get wrong.
--
-- Byline is always the desk (never a fabricated person) — see docs/about
-- policy and the /about transparency page.

CREATE TABLE IF NOT EXISTS public.weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  body text NOT NULL DEFAULT '',
  headline text,
  mentioned_story_ids uuid[] NOT NULL DEFAULT '{}',
  story_count integer NOT NULL DEFAULT 0,
  is_quiet_week boolean NOT NULL DEFAULT false,
  model text,
  prompt_version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'draft',
  generation_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One recap per city per week; regeneration upserts rather than duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_recaps_city_week
  ON public.weekly_recaps (city_id, week_start);

CREATE INDEX IF NOT EXISTS idx_weekly_recaps_city_published
  ON public.weekly_recaps (city_id, status, week_start DESC);

ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published weekly recaps" ON public.weekly_recaps;
CREATE POLICY "Public can view published weekly recaps" ON public.weekly_recaps
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Admins can manage weekly recaps" ON public.weekly_recaps;
CREATE POLICY "Admins can manage weekly recaps" ON public.weekly_recaps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Sunday 5:00pm CT (22:00 UTC) — after the day's ingestion, before the
-- evening read. Idempotent per (city, week).
SELECT cron.schedule(
  'generate-weekly-recap-sunday',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-weekly-recap',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== 20260731120000_news_freshness_pipeline.sql ============================
-- News-freshness pipeline repair. The public feed filters on THREE columns
-- (status, safety_level, publish_date) but the webhook ingestion path
-- (ingest-news / ingest-civic) inserted rows that failed all three:
--
--   * status stayed 'pending' forever — nothing automated ever approved these
--     rows, and bulk-approve-content skips them anyway because…
--   * safety_level was NULL (column has no default), which fails both the
--     feed's IN ('safe','soft_sensitive') filter and bulk-approve eligibility;
--   * publish_date was NULL whenever the scraper couldn't extract an original
--     publish time, which fails the feed's date-window filters.
--
-- Net effect: every paper-of-record article ingested since the n8n removal
-- was invisible on the site, even after manual approval. The edge functions
-- are fixed alongside this migration; this file repairs the stored rows and
-- adds a belt-and-suspenders trigger so publish_date can never be NULL again.

-- 1) publish_date must never be NULL: default it to ingestion time on insert,
--    whatever the insert path.
CREATE OR REPLACE FUNCTION public.content_queue_default_publish_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.publish_date IS NULL THEN
    NEW.publish_date := COALESCE(NEW.created_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_content_queue_default_publish_date ON public.content_queue;
CREATE TRIGGER trg_content_queue_default_publish_date
  BEFORE INSERT ON public.content_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.content_queue_default_publish_date();

-- 2) Backfill existing NULL publish_date rows from ingestion time.
UPDATE public.content_queue
SET publish_date = created_at
WHERE publish_date IS NULL;

-- 3) Classify rows with NULL safety_level via the same keyword screen the
--    fixed ingest-news now applies: crime/courts, death/tragedy, and charged
--    topics are 'sensitive' (stay held for review); everything else is 'safe'.
--    Tagged 'keyword_screen' so step 4 (and future audits) can identify them.
UPDATE public.content_queue
SET
  safety_level = CASE
    WHEN (title || ' ' || COALESCE(summary, '') || ' ' || LEFT(COALESCE(content, ''), 2000)) ~* '\y(arrest|arrested|police|sheriff|crime|criminal|charged|charges|sentenced|guilty|lawsuit|court|jail|prison|theft|burglary|robbery|assault|battery|shooting|shot|stabbed|stabbing|homicide|murder|drugs|overdose|dui|owi|dies|died|death|dead|fatal|fatality|killed|obituary|suicide|drowned|drowning|crash|collision|missing person|protest|election|campaign|layoff|layoffs|outbreak|abuse|scandal|fraud)\y'
    THEN 'sensitive'
    ELSE 'safe'
  END,
  safety_tags = COALESCE(safety_tags, '[]'::jsonb) || '["keyword_screen"]'::jsonb,
  safety_reason = 'Backfill: keyword screen (safety_level was NULL, invisible to feed and bulk approval)'
WHERE safety_level IS NULL;

-- 4) Unstick the recent backlog: hyperlocal keyword-screened-safe rows that
--    were stranded in 'pending' auto-publish, matching the decision the fixed
--    ingest-news would have made at insert time. Limited to the feed's own
--    14-day window so nothing stale resurfaces.
UPDATE public.content_queue
SET
  status = 'auto_published',
  decision_path = 'freshness_backfill_auto',
  hold_reason = NULL
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND safety_tags @> '["keyword_screen"]'::jsonb
  AND geo_tier >= 1
  AND created_at >= now() - interval '14 days';

-- ===== 20260803120000_schedule_real_estate_refresh.sql =======================
-- Monthly refresh of real_estate_metrics from Zillow's public research CSVs.
-- The table was hand-seeded once and had no writer anywhere in the codebase,
-- so /market-report served stale figures under an "updated monthly" banner.
-- Zillow publishes ZHVI updates around the middle of each month, so the 18th
-- catches the fresh file without racing it.
SELECT cron.schedule(
  'refresh-real-estate-monthly',
  '0 13 18 * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/refresh-real-estate-metrics',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== submit-indexnow hourly ===============================================
-- Promoted from docs/RUNBOOK.md item 5 into code: the Bing-family index is
-- where 84 of 95 search visits come from, and IndexNow tells it about new
-- content in minutes instead of days. The function batches per city and
-- no-ops when nothing changed in the window, so hourly is cheap.
SELECT cron.schedule(
  'submit-indexnow-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/submit-indexnow',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ===== VERIFICATION ========================================================
-- Every row should say true / a sane count. If city_id_present is false the
-- multi-city batch did not land; if stranded_now_visible is 0 that is fine
-- (it means there was no stranded backlog), but publish_date_trigger must be true.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='content_queue' AND column_name='city_id')      AS city_id_present,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='city_config')                                  AS city_config_present,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='weekly_recaps')                                AS weekly_recaps_present,
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgname LIKE '%publish_date%')                              AS publish_date_trigger,
  (SELECT count(*) FROM content_queue
   WHERE status IN ('published','auto_published')
     AND publish_date > now() - interval '48 hours')                       AS stories_live_last_48h;
