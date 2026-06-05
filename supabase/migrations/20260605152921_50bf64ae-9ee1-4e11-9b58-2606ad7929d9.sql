
CREATE TABLE public.community_venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection TEXT NOT NULL,
  slug TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  neighborhood TEXT,
  short_descriptor TEXT,
  editor_note TEXT,
  is_editorial_pick BOOLEAN NOT NULL DEFAULT false,
  display_rank INTEGER,
  business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (collection, slug)
);

CREATE INDEX idx_community_venues_collection ON public.community_venues(collection) WHERE status = 'active';

GRANT SELECT ON public.community_venues TO anon;
GRANT SELECT ON public.community_venues TO authenticated;
GRANT ALL ON public.community_venues TO service_role;

ALTER TABLE public.community_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active community venues"
  ON public.community_venues FOR SELECT
  USING (status = 'active');

CREATE POLICY "Admins manage community venues"
  ON public.community_venues FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_community_venues_updated_at
  BEFORE UPDATE ON public.community_venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
