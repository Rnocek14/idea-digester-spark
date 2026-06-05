
-- ============================================================
-- Track 2: editorial control for the Later rail
-- ============================================================

ALTER TABLE public.content_queue
  ADD COLUMN IF NOT EXISTS featured_in_later     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editorial_pick_reason text,
  ADD COLUMN IF NOT EXISTS featured_rank         smallint,
  ADD COLUMN IF NOT EXISTS featured_until        date,
  ADD COLUMN IF NOT EXISTS pick_tag              text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submitted_by_email    text,
  ADD COLUMN IF NOT EXISTS submitter_name        text;

ALTER TABLE public.content_queue
  DROP CONSTRAINT IF EXISTS content_queue_featured_rank_check;
ALTER TABLE public.content_queue
  ADD  CONSTRAINT content_queue_featured_rank_check
       CHECK (featured_rank IS NULL OR featured_rank BETWEEN 1 AND 3);

ALTER TABLE public.content_queue
  DROP CONSTRAINT IF EXISTS content_queue_pick_tag_check;
ALTER TABLE public.content_queue
  ADD  CONSTRAINT content_queue_pick_tag_check
       CHECK (
         pick_tag <@ ARRAY[
           'worth_leaving_the_house_for',
           'low_key_weekend',
           'good_for_visitors',
           'locals_will_care'
         ]::text[]
       );

CREATE INDEX IF NOT EXISTS content_queue_featured_later_idx
  ON public.content_queue (featured_until, featured_rank)
  WHERE featured_in_later = true;

CREATE INDEX IF NOT EXISTS content_queue_pick_tag_gin
  ON public.content_queue USING GIN (pick_tag);

CREATE OR REPLACE FUNCTION public.sync_featured_until()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.featured_in_later = true THEN
    IF NEW.featured_until IS NULL THEN
      NEW.featured_until := COALESCE(NEW.event_date, CURRENT_DATE) + INTERVAL '1 day';
    END IF;
  ELSE
    NEW.featured_until := NULL;
    NEW.featured_rank  := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_featured_until_trg ON public.content_queue;
CREATE TRIGGER sync_featured_until_trg
  BEFORE INSERT OR UPDATE OF featured_in_later, featured_until, event_date
  ON public.content_queue
  FOR EACH ROW EXECUTE FUNCTION public.sync_featured_until();

CREATE OR REPLACE FUNCTION public.log_feature_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.featured_in_later,false) IS DISTINCT FROM COALESCE(NEW.featured_in_later,false) THEN
    INSERT INTO public.activity_log (user_id, actor_type, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'user',
      CASE WHEN NEW.featured_in_later THEN 'feature_in_later' ELSE 'unfeature_in_later' END,
      'content_queue',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'event_date', NEW.event_date,
        'rank', NEW.featured_rank,
        'reason', NEW.editorial_pick_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_feature_change_trg ON public.content_queue;
CREATE TRIGGER log_feature_change_trg
  AFTER UPDATE OF featured_in_later ON public.content_queue
  FOR EACH ROW EXECUTE FUNCTION public.log_feature_change();


-- ============================================================
-- Track 3: Community Desk
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_authors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio          text,
  avatar_url   text,
  email        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_authors TO anon;
GRANT SELECT ON public.community_authors TO authenticated;
GRANT ALL    ON public.community_authors TO service_role;

ALTER TABLE public.community_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors are publicly readable when active"
  ON public.community_authors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage authors"
  ON public.community_authors FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS community_authors_updated_at ON public.community_authors;
CREATE TRIGGER community_authors_updated_at
  BEFORE UPDATE ON public.community_authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.community_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  category        text,
  body            text NOT NULL,
  subject_name    text,
  subject_type    text,
  photo_url       text,
  historical_year smallint,
  submitter_name  text,
  submitter_town  text,
  submitter_email text,
  submitter_ip    inet,
  honeypot        text,
  review_notes    text,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT community_submissions_kind_check
    CHECK (kind IN ('local_love','tip','memory')),
  CONSTRAINT community_submissions_status_check
    CHECK (status IN ('pending','approved','rejected','published')),
  CONSTRAINT community_submissions_category_check
    CHECK (
      category IS NULL OR (
        (kind = 'local_love' AND category IN ('people','places','moments'))
        OR (kind = 'memory'   AND category IN ('historical'))
      )
    ),
  CONSTRAINT community_submissions_body_len_check
    CHECK (char_length(body) BETWEEN 4 AND 2000),
  CONSTRAINT community_submissions_local_love_body_len
    CHECK (kind <> 'local_love' OR char_length(body) <= 280)
);

GRANT SELECT ON public.community_submissions TO anon;
GRANT SELECT ON public.community_submissions TO authenticated;
GRANT ALL    ON public.community_submissions TO service_role;

ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved local_love"
  ON public.community_submissions FOR SELECT
  USING (kind = 'local_love' AND status IN ('approved','published'));

CREATE POLICY "Admins manage submissions"
  ON public.community_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS community_submissions_kind_status_idx
  ON public.community_submissions (kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS community_submissions_local_love_public_idx
  ON public.community_submissions (created_at DESC)
  WHERE kind = 'local_love' AND status IN ('approved','published');

DROP TRIGGER IF EXISTS community_submissions_updated_at ON public.community_submissions;
CREATE TRIGGER community_submissions_updated_at
  BEFORE UPDATE ON public.community_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.community_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  body_md         text NOT NULL,
  excerpt         text,
  hero_image_url  text,
  category        text NOT NULL,
  author_id       uuid REFERENCES public.community_authors(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft',
  historical_year smallint,
  published_at    timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  review_notes    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT community_posts_category_check
    CHECK (category IN (
      'local_opinion','memories','business_notes',
      'lake_life','arts_culture','neighbor_notes','throwback'
    )),
  CONSTRAINT community_posts_status_check
    CHECK (status IN ('draft','submitted','approved','published','rejected')),
  CONSTRAINT community_posts_title_len_check
    CHECK (char_length(title) BETWEEN 4 AND 200),
  CONSTRAINT community_posts_body_len_check
    CHECK (char_length(body_md) BETWEEN 50 AND 30000)
);

GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT ON public.community_posts TO authenticated;
GRANT ALL    ON public.community_posts TO service_role;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published posts"
  ON public.community_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins manage posts"
  ON public.community_posts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS community_posts_published_idx
  ON public.community_posts (published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS community_posts_category_published_idx
  ON public.community_posts (category, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS community_posts_admin_queue_idx
  ON public.community_posts (status, created_at DESC);

DROP TRIGGER IF EXISTS community_posts_updated_at ON public.community_posts;
CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE OR REPLACE FUNCTION public.log_community_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved','published','rejected') THEN
    INSERT INTO public.activity_log (user_id, actor_type, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'user',
      'community_' || NEW.status,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_submissions_status_audit ON public.community_submissions;
CREATE TRIGGER community_submissions_status_audit
  AFTER UPDATE OF status ON public.community_submissions
  FOR EACH ROW EXECUTE FUNCTION public.log_community_status_change();

DROP TRIGGER IF EXISTS community_posts_status_audit ON public.community_posts;
CREATE TRIGGER community_posts_status_audit
  AFTER UPDATE OF status ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.log_community_status_change();
