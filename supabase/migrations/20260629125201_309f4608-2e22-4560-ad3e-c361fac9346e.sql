
-- Daily morning brief, one row per date
CREATE TABLE public.daily_briefs (
  brief_date date PRIMARY KEY,
  body text NOT NULL,
  mentioned_story_ids uuid[] NOT NULL DEFAULT '{}',
  is_quiet_day boolean NOT NULL DEFAULT false,
  model text,
  prompt_version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'published', -- 'draft' | 'published' (room to add an approve gate later)
  generation_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_briefs TO anon;
GRANT SELECT ON public.daily_briefs TO authenticated;
GRANT ALL ON public.daily_briefs TO service_role;

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_briefs are publicly readable when published"
  ON public.daily_briefs FOR SELECT
  USING (status = 'published');

CREATE TRIGGER daily_briefs_set_updated_at
  BEFORE UPDATE ON public.daily_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One-sentence lake/weather beat, one row per date
CREATE TABLE public.lake_beats (
  beat_date date PRIMARY KEY,
  body text NOT NULL,
  temp_f integer,
  conditions text,
  model text,
  generation_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lake_beats TO anon;
GRANT SELECT ON public.lake_beats TO authenticated;
GRANT ALL ON public.lake_beats TO service_role;

ALTER TABLE public.lake_beats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lake_beats are publicly readable"
  ON public.lake_beats FOR SELECT
  USING (true);
