
-- 1. Extend incidents table
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS confidence_score smallint DEFAULT 50,
  ADD COLUMN IF NOT EXISTS tier smallint,
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS ai_rewrite text,
  ADD COLUMN IF NOT EXISTS original_body text,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision;

COMMENT ON COLUMN public.incidents.source_type IS 'facebook | rss | email | webhook | official | manual | community_tip | nixle | apify';
COMMENT ON COLUMN public.incidents.tier IS '1=auto-publish, 2=ai-rewrite-then-publish, 3=hold-for-review, 4=auto-reject';

-- 2. incident_reject_rules: learned keywords from admin "Reject + train"
CREATE TABLE IF NOT EXISTS public.incident_reject_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  reason text,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.incident_reject_rules TO authenticated;
GRANT ALL ON public.incident_reject_rules TO service_role;

ALTER TABLE public.incident_reject_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reject rules"
  ON public.incident_reject_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. incident_source_observations: each independent source report of a given incident
CREATE TABLE IF NOT EXISTS public.incident_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_type text,
  external_id text,
  raw jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, source)
);

CREATE INDEX IF NOT EXISTS idx_iso_incident ON public.incident_source_observations(incident_id);
CREATE INDEX IF NOT EXISTS idx_iso_observed_at ON public.incident_source_observations(observed_at DESC);

GRANT SELECT ON public.incident_source_observations TO authenticated;
GRANT ALL ON public.incident_source_observations TO service_role;

ALTER TABLE public.incident_source_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read observations"
  ON public.incident_source_observations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Helpful index for queue UI
CREATE INDEX IF NOT EXISTS idx_incidents_status_started
  ON public.incidents(status, started_at DESC);
