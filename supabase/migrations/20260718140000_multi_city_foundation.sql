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
