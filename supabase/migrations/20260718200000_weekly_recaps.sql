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
