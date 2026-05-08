
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS trust_locality boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_trust_score smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS content_confidence_score smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS supports_events boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_live_music boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_recurring_events boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_ticket_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_geo_enrichment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_zero_items_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_zero_runs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_nonzero_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_items_ingested_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_severity text NOT NULL DEFAULT 'ok';

CREATE INDEX IF NOT EXISTS idx_sources_health_severity ON public.sources(health_severity)
  WHERE health_severity <> 'ok';
CREATE INDEX IF NOT EXISTS idx_sources_trust_locality ON public.sources(trust_locality)
  WHERE trust_locality = true;

-- Helper to invoke an edge function from cron without baking the anon key into each schedule.
-- The anon key is read from a project-level GUC (app.settings.anon_key) when present, falling
-- back to the service-role GUC. Set GUCs via:
--   ALTER DATABASE postgres SET app.settings.anon_key = '...';
-- (handled outside migrations to avoid leaking secrets).
CREATE OR REPLACE FUNCTION public.invoke_edge_function(_name text, _body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _key text;
  _req_id bigint;
BEGIN
  _url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/' || _name;
  _key := coalesce(
    current_setting('app.settings.anon_key', true),
    current_setting('app.settings.service_role_key', true),
    ''
  );

  SELECT net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := coalesce(_body, '{}'::jsonb)
  ) INTO _req_id;

  RETURN _req_id;
END;
$$;
