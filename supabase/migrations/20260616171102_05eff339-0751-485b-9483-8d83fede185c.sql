-- Reader suggestions (anonymous suggestion box)
CREATE TABLE public.reader_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 1000),
  email text CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  page_path text,
  session_id text,
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.reader_suggestions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reader_suggestions TO authenticated;
GRANT ALL ON public.reader_suggestions TO service_role;

ALTER TABLE public.reader_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a suggestion"
  ON public.reader_suggestions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read suggestions"
  ON public.reader_suggestions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update suggestions"
  ON public.reader_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reader_suggestions_set_updated_at
  BEFORE UPDATE ON public.reader_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX reader_suggestions_status_created_idx
  ON public.reader_suggestions(status, created_at DESC);

-- Story reactions (per-story anonymous signal)
CREATE TABLE public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  session_id text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('helpful','more_like_this','not_for_me')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, session_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO anon, authenticated;
GRANT ALL ON public.story_reactions TO service_role;

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
  ON public.story_reactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert a reaction"
  ON public.story_reactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update or delete by session"
  ON public.story_reactions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete by session"
  ON public.story_reactions FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE TRIGGER story_reactions_set_updated_at
  BEFORE UPDATE ON public.story_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX story_reactions_story_idx ON public.story_reactions(story_id);
CREATE INDEX story_reactions_created_idx ON public.story_reactions(created_at DESC);