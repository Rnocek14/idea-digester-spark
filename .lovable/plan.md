
# Migration plan — Track 2 + Track 3 schema (review before apply)

This is the full SQL I intend to send through `supabase--migration`. Nothing runs until you say "apply." Read the SQL, flag anything you want changed, and I'll revise.

The migration is **additive only** — no destructive changes to `content_queue` data. Rollback notes at the bottom.

---

## Design decisions baked into the SQL

- **Tables**: `community_authors`, `community_submissions`, `community_posts`. Plus 7 new columns on `content_queue`.
- **Status / kind / category** are all enforced with `CHECK` constraints (per your guardrail) — not Postgres enums, because enums are painful to evolve and we're going to add categories later.
- **`/submit` writes go through an Edge Function only.** Anon has **no `INSERT` grant** on `community_submissions`. The edge function uses the service role. Same for `community_posts`.
- **Public read = approved/published only.** Anon can `SELECT` from these tables but RLS limits rows to the approved/published subset.
- **`featured_until` auto-default**: a `BEFORE INSERT/UPDATE` trigger sets `featured_until = event_date + 1 day` whenever `featured_in_later = true` and `featured_until IS NULL`. When `featured_in_later` flips to `false`, `featured_until` is cleared. This keeps the homepage query dead simple.
- **Audit trail**: a trigger writes to `activity_log` on (a) `content_queue.featured_in_later` flips and (b) `community_*` status transitions to `approved`/`published`/`rejected`. No edge function code needed for audit.
- **Indexes** sized for the actual homepage queries we'll run.
- **`pick_tag`** uses a GIN index + a check that every element is in the allowed set.

---

## The migration SQL

```sql
-- ============================================================
-- Track 2: editorial control for the Later rail
-- ============================================================

ALTER TABLE public.content_queue
  ADD COLUMN IF NOT EXISTS featured_in_later   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editorial_pick_reason text,
  ADD COLUMN IF NOT EXISTS featured_rank       smallint,
  ADD COLUMN IF NOT EXISTS featured_until      date,
  ADD COLUMN IF NOT EXISTS pick_tag            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submitted_by_email  text,
  ADD COLUMN IF NOT EXISTS submitter_name      text;

-- featured_rank must be 1..3 when set
ALTER TABLE public.content_queue
  DROP CONSTRAINT IF EXISTS content_queue_featured_rank_check;
ALTER TABLE public.content_queue
  ADD  CONSTRAINT content_queue_featured_rank_check
       CHECK (featured_rank IS NULL OR featured_rank BETWEEN 1 AND 3);

-- pick_tag values are constrained to the controlled vocabulary
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

-- Homepage Later query: WHERE featured_in_later AND featured_until >= today
CREATE INDEX IF NOT EXISTS content_queue_featured_later_idx
  ON public.content_queue (featured_until, featured_rank)
  WHERE featured_in_later = true;

-- Picks rail query: WHERE pick_tag && ARRAY['...']
CREATE INDEX IF NOT EXISTS content_queue_pick_tag_gin
  ON public.content_queue USING GIN (pick_tag);

-- Auto-manage featured_until when featured_in_later toggles
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

-- Audit: log feature/unfeature into activity_log
CREATE OR REPLACE FUNCTION public.log_feature_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.featured_in_later,false) IS DISTINCT FROM COALESCE(NEW.featured_in_later,false) THEN
    INSERT INTO public.activity_log (action, entity_type, entity_id, metadata)
    VALUES (
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

-- ---- community_authors ----
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

CREATE TRIGGER community_authors_updated_at
  BEFORE UPDATE ON public.community_authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---- community_submissions (Local Love + tips + memories) ----
CREATE TABLE IF NOT EXISTS public.community_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL,            -- 'local_love' | 'tip' | 'memory'
  status          text NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'published'
  category        text,                     -- local_love: 'people'|'places'|'moments' ; memory: 'historical' ; tip: null
  body            text NOT NULL,
  subject_name    text,                     -- who/what is being praised (local_love)
  subject_type    text,                     -- 'person'|'place'|'moment' (local_love)
  photo_url       text,
  historical_year smallint,                 -- memory only
  submitter_name  text,
  submitter_town  text,
  submitter_email text,
  submitter_ip    inet,
  honeypot        text,                     -- always expected empty server-side
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
-- NOTE: no INSERT for anon/authenticated. Submissions flow through the edge function only.

ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

-- Public reads only the approved Local Love wall.
CREATE POLICY "Public can read approved local_love"
  ON public.community_submissions FOR SELECT
  USING (kind = 'local_love' AND status IN ('approved','published'));

-- Admins see and manage everything.
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

CREATE TRIGGER community_submissions_updated_at
  BEFORE UPDATE ON public.community_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---- community_posts (Voices + Throwback) ----
CREATE TABLE IF NOT EXISTS public.community_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  body_md         text NOT NULL,
  excerpt         text,
  hero_image_url  text,
  category        text NOT NULL,            -- 'local_opinion'|'memories'|'business_notes'|'lake_life'|'arts_culture'|'neighbor_notes'|'throwback'
  author_id       uuid REFERENCES public.community_authors(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft', -- 'draft'|'submitted'|'approved'|'published'|'rejected'
  historical_year smallint,                 -- throwback only
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

CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---- Audit: status transitions on community tables ----
CREATE OR REPLACE FUNCTION public.log_community_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved','published','rejected') THEN
    INSERT INTO public.activity_log (action, entity_type, entity_id, metadata)
    VALUES (
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
```

---

## What I'm assuming about your schema (worth confirming before apply)

1. **`activity_log` columns**: I'm writing `(action, entity_type, entity_id, metadata)` — that matches the pattern used elsewhere in this project. If your `activity_log` requires `user_id NOT NULL`, I need to either add it (`auth.uid()` from the calling session) or relax the column. I'll verify in the next read pass before I send the migration; if there's a mismatch I'll patch the trigger to match the table.
2. **`has_role(auth.uid(), 'admin')`** already exists (confirmed in db functions). Good.
3. **`update_updated_at_column()`** already exists. Good.
4. **`content_queue.event_date`** is a `date` (confirmed by existing event queries). Good.

---

## Rollback notes (paste-ready, only if needed)

```sql
-- Track 3 rollback
DROP TABLE IF EXISTS public.community_posts CASCADE;
DROP TABLE IF EXISTS public.community_submissions CASCADE;
DROP TABLE IF EXISTS public.community_authors CASCADE;
DROP FUNCTION IF EXISTS public.log_community_status_change();

-- Track 2 rollback
DROP TRIGGER IF EXISTS log_feature_change_trg ON public.content_queue;
DROP TRIGGER IF EXISTS sync_featured_until_trg ON public.content_queue;
DROP FUNCTION IF EXISTS public.log_feature_change();
DROP FUNCTION IF EXISTS public.sync_featured_until();
DROP INDEX IF EXISTS public.content_queue_pick_tag_gin;
DROP INDEX IF EXISTS public.content_queue_featured_later_idx;
ALTER TABLE public.content_queue
  DROP CONSTRAINT IF EXISTS content_queue_pick_tag_check,
  DROP CONSTRAINT IF EXISTS content_queue_featured_rank_check,
  DROP COLUMN IF EXISTS submitter_name,
  DROP COLUMN IF EXISTS submitted_by_email,
  DROP COLUMN IF EXISTS pick_tag,
  DROP COLUMN IF EXISTS featured_until,
  DROP COLUMN IF EXISTS featured_rank,
  DROP COLUMN IF EXISTS editorial_pick_reason,
  DROP COLUMN IF EXISTS featured_in_later;
```

---

## What happens after you approve

1. I confirm `activity_log` shape with a quick `read_query` and adjust the two trigger functions if needed (no other SQL changes).
2. I fire `supabase--migration` with the SQL above.
3. After it lands, I build, in order:
   - `submit-community` edge function (validates with Zod, honeypot, IP rate-limit, writes to `community_submissions` or `content_queue`, fires Resend confirmation).
   - `/submit` page (three-tab form).
   - `/community/local-love` public wall.
   - Admin "Feature in Later" toggle + reason/rank inputs in `/content-queue`.
   - Homepage Later query flip with auto-fallback when fewer than 2 picks exist.

## Questions before I send the migration

1. **`activity_log.user_id`** — is it nullable? (Determines whether the audit triggers need to pull `auth.uid()`.) I can verify with a quick read query if you'd rather I just check.
2. **Photo uploads in Local Love v1** — yes (Storage bucket `community-submissions`) or text-only? The schema already has `photo_url` so both work; this only affects the edge function + form.
3. **Voices launch state** — empty page with a "Pitch us" CTA, or do you have 2–3 contributors lined up so I should seed `community_authors`?

Say "apply" and I'll verify `activity_log` then run the migration. Or paste edits and I'll revise the SQL first.
