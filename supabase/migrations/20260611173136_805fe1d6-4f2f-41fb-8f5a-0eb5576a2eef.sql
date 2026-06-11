
CREATE TABLE public.business_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  story_type TEXT NOT NULL CHECK (story_type IN ('new_on_menu','owner_spotlight','behind_the_business','seasonal_update','history','event','reopening')),
  headline TEXT NOT NULL,
  raw_input TEXT NOT NULL,
  owner_quote TEXT,
  photo_url TEXT,
  source_citation TEXT,
  ai_draft TEXT,
  ai_draft_generated_at TIMESTAMPTZ,
  final_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ai_drafted','approved','published','rejected','archived')),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_email TEXT,
  submitter_role TEXT DEFAULT 'editor' CHECK (submitter_role IN ('owner','editor','admin','public')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  scheduled_for DATE,
  last_rotated_at TIMESTAMPTZ,
  rotation_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_stories TO authenticated;
GRANT ALL ON public.business_stories TO service_role;

ALTER TABLE public.business_stories ENABLE ROW LEVEL SECURITY;

-- Public can read published stories only
CREATE POLICY "Public can read published business stories"
ON public.business_stories FOR SELECT
TO anon
USING (status = 'published');

-- Authenticated users can read all (so editors/owners see queue)
CREATE POLICY "Authenticated can read all business stories"
ON public.business_stories FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can submit
CREATE POLICY "Authenticated can insert business stories"
ON public.business_stories FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Submitters can update their own pending/draft rows; admins update anything
CREATE POLICY "Submitters and admins can update business stories"
ON public.business_stories FOR UPDATE
TO authenticated
USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete business stories"
ON public.business_stories FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_business_stories_status ON public.business_stories(status);
CREATE INDEX idx_business_stories_business ON public.business_stories(business_id);
CREATE INDEX idx_business_stories_published_at ON public.business_stories(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_business_stories_scheduled ON public.business_stories(scheduled_for) WHERE status = 'approved';

CREATE TRIGGER update_business_stories_updated_at
BEFORE UPDATE ON public.business_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rotation helper: pick the next approved story (least recently rotated)
CREATE OR REPLACE FUNCTION public.get_todays_business_story()
RETURNS public.business_stories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Prefer a published story from today; else most recent published in last 7 days
  SELECT * FROM public.business_stories
  WHERE status = 'published'
    AND published_at >= now() - interval '7 days'
  ORDER BY published_at DESC
  LIMIT 1;
$$;
