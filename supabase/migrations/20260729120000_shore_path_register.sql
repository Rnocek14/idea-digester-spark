-- The Shore Path Register — walkers, verified stop visits, and the numbered
-- finisher register.
--
-- Why a register and not a leaderboard: the Shore Path is a 21-mile public
-- easement that runs a few feet from private front porches, and the arrangement
-- survives because walkers behave. Ranking people by speed would put a bounty
-- on running past someone's kitchen window. Ranking nobody, and instead issuing
-- a permanent sequential number for *completing* the loop, is the Adirondack
-- 46er / Camino model: the status comes from finishing, and the early numbers
-- are the scarce thing. That also inverts the cold-start problem — walker #37
-- is #37 forever, so being early is the reward rather than a wasted entry.
--
-- Writes never come from the browser. `path_walkers` and `path_stop_visits`
-- hold location history, so anon has no grants on them at all; everything goes
-- through the rate-limited `path-register` edge function on the service role,
-- matching the pattern established when the incidents RLS was hardened
-- (20260718120000_harden_incidents_rls.sql). The only publicly readable table
-- is `path_register_entries`, and only rows the walker opted to publish.

-- ---------------------------------------------------------------------------
-- 1. Walkers
-- ---------------------------------------------------------------------------
-- Deliberately not tied to auth.users. Requiring a password to start collecting
-- stops would kill the feature at the trailhead; instead the browser holds an
-- opaque claim_token, exactly as anonymous story reactions already work. Email
-- is optional and only used to recover a passport across devices.
CREATE TABLE IF NOT EXISTS public.path_walkers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  claim_token text NOT NULL UNIQUE CHECK (char_length(claim_token) BETWEEN 20 AND 100),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40),
  home_town text CHECK (home_town IS NULL OR char_length(home_town) <= 60),
  email text CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Opt-in, not opt-out: a walker collects stops privately until they choose to
  -- appear on the public register.
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.path_walkers TO service_role;
ALTER TABLE public.path_walkers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read walkers" ON public.path_walkers;
CREATE POLICY "Admins can read walkers" ON public.path_walkers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_path_walkers_city ON public.path_walkers (city_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_path_walkers_updated_at ON public.path_walkers;
CREATE TRIGGER trg_path_walkers_updated_at
  BEFORE UPDATE ON public.path_walkers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. Legs
-- ---------------------------------------------------------------------------
-- The seven official measured legs, previously hardcoded as LEG_DISTANCES in
-- LakeGenevaShorePath.tsx. Source: the Geneva Lake Shore Path map published by
-- the Williams Bay Recreation Department, which is also the cited source for
-- the leg table and restroom list on the guide page.
CREATE TABLE IF NOT EXISTS public.path_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  from_label text NOT NULL,
  to_label text NOT NULL,
  miles numeric NOT NULL CHECK (miles > 0),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, order_index)
);

GRANT SELECT ON public.path_legs TO anon, authenticated;
GRANT ALL ON public.path_legs TO service_role;
ALTER TABLE public.path_legs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published legs" ON public.path_legs;
CREATE POLICY "Anyone can read published legs" ON public.path_legs
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage legs" ON public.path_legs;
CREATE POLICY "Admins manage legs" ON public.path_legs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_path_legs_updated_at ON public.path_legs;
CREATE TRIGGER trg_path_legs_updated_at
  BEFORE UPDATE ON public.path_legs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.path_legs (city_id, order_index, from_label, to_label, miles)
VALUES
  ('default', 1, 'Williams Bay',   'Fontana',        3.5),
  ('default', 2, 'Fontana',        'Shadow Lane',    2.3),
  ('default', 3, 'Shadow Lane',    'Linn Road',      2.9),
  ('default', 4, 'Linn Road',      'Big Foot Beach', 3.3),
  ('default', 5, 'Big Foot Beach', 'Lake Geneva',    2.0),
  ('default', 6, 'Lake Geneva',    'Chapin Road',    3.5),
  ('default', 7, 'Chapin Road',    'Williams Bay',   3.5)
ON CONFLICT (city_id, order_index) DO NOTHING;

-- Which official leg each stop sits on. Left NULL on purpose: the seeded
-- `approx_mile` values run clockwise from Library Park while the official leg
-- table runs the other way from Williams Bay, and the two axes do not reconcile
-- (the guide page itself calls its mile figures "approximate"). Deriving leg
-- membership from that mismatch would hand out wrong badges, so leg badges stay
-- dormant until editorial assigns these against the official map. Everything
-- else — stops, the loop, four seasons — works without it.
ALTER TABLE public.shore_path_stops
  ADD COLUMN IF NOT EXISTS leg_order_index integer;

COMMENT ON COLUMN public.shore_path_stops.leg_order_index IS
  'Official leg (path_legs.order_index) this stop belongs to. NULL until editorial verifies against the Williams Bay Rec Dept map; leg badges are not awarded for legs with no stops assigned.';

-- ---------------------------------------------------------------------------
-- 3. Stop visits
-- ---------------------------------------------------------------------------
-- One row per walker per stop per calendar day. The unique index is what makes
-- the geofence safe to leave running: standing at Library Park for twenty
-- minutes re-fires arrival detection repeatedly and must not inflate anything.
--
-- `verification` records provenance rather than pretending to certainty:
--   verified      — geofence confirmed server-side against the stop's coords
--   imported      — from a GPX/device file (forgeable in principle, still useful)
--   self_reported — typed in by hand
-- The register displays this, and the finisher certificate requires 'verified'.
CREATE TABLE IF NOT EXISTS public.path_stop_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  walker_id uuid NOT NULL REFERENCES public.path_walkers(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.shore_path_stops(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  -- Local calendar date and season bucket, computed in the city's timezone by
  -- the edge function. Stored rather than derived so a timezone change never
  -- silently rewrites which season a past walk counted for.
  visit_date date NOT NULL,
  season text NOT NULL CHECK (season IN ('spring', 'summer', 'fall', 'winter')),
  verification text NOT NULL DEFAULT 'self_reported'
    CHECK (verification IN ('verified', 'imported', 'self_reported')),
  -- Distance from the stop when the geofence fired, and the device's own
  -- accuracy estimate. Kept for auditing a disputed entry; never shown publicly.
  distance_m numeric,
  accuracy_m numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_path_stop_visits_walker_stop_day
  ON public.path_stop_visits (walker_id, stop_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_path_stop_visits_walker
  ON public.path_stop_visits (walker_id, visited_at DESC);
-- Supports the conditions/almanac aggregation that reads visits by stop + season.
CREATE INDEX IF NOT EXISTS idx_path_stop_visits_stop_season
  ON public.path_stop_visits (stop_id, season);

GRANT ALL ON public.path_stop_visits TO service_role;
ALTER TABLE public.path_stop_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read stop visits" ON public.path_stop_visits;
CREATE POLICY "Admins can read stop visits" ON public.path_stop_visits
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 4. The register
-- ---------------------------------------------------------------------------
-- Numbered entries, issued in completion order, never recycled. Two tiers get a
-- number: the loop (all published stops) and four seasons (the loop completed
-- within each of the four season buckets, aggregated across years). Stop and leg
-- badges are derived from visits and deliberately get no number — diluting the
-- number is what would make it worthless.
--
-- display_name and home_town are denormalised at completion time. That keeps
-- anon off path_walkers entirely, and it is also correct for a register: the
-- entry is a historical record of who finished, not a live profile.
CREATE TABLE IF NOT EXISTS public.path_register_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  walker_id uuid NOT NULL REFERENCES public.path_walkers(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('loop', 'four_seasons')),
  entry_number integer NOT NULL CHECK (entry_number > 0),
  display_name text,
  home_town text,
  first_visit_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  days_elapsed integer,
  stops_total integer NOT NULL DEFAULT 0,
  verification text NOT NULL DEFAULT 'self_reported'
    CHECK (verification IN ('verified', 'imported', 'self_reported')),
  certificate_code text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gapless per city per tier, and one number per walker per tier.
CREATE UNIQUE INDEX IF NOT EXISTS uq_path_register_city_tier_number
  ON public.path_register_entries (city_id, tier, entry_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_path_register_walker_tier
  ON public.path_register_entries (walker_id, tier);
CREATE INDEX IF NOT EXISTS idx_path_register_public
  ON public.path_register_entries (city_id, tier, entry_number)
  WHERE is_public = true;

-- Column-level grants: walker_id and certificate_code are withheld from anon so
-- a public register page cannot be used to enumerate walkers or forge a
-- certificate lookup.
GRANT SELECT (
  id, city_id, tier, entry_number, display_name, home_town,
  completed_at, days_elapsed, stops_total, verification, is_public
) ON public.path_register_entries TO anon, authenticated;
GRANT ALL ON public.path_register_entries TO service_role;

ALTER TABLE public.path_register_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published register entries" ON public.path_register_entries;
CREATE POLICY "Public can view published register entries" ON public.path_register_entries
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Admins can read all register entries" ON public.path_register_entries;
CREATE POLICY "Admins can read all register entries" ON public.path_register_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_path_register_updated_at ON public.path_register_entries;
CREATE TRIGGER trg_path_register_updated_at
  BEFORE UPDATE ON public.path_register_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. Issuing a number
-- ---------------------------------------------------------------------------
-- Gapless numbering under concurrency. A plain sequence would burn numbers on
-- rollback, and "where did #47 go?" is precisely the question a register cannot
-- have to answer — so this takes a transaction-scoped advisory lock keyed on
-- (city, tier) and computes MAX + 1 inside it.
--
-- Idempotent: a walker who re-triggers completion gets their existing entry back
-- rather than a second number.
CREATE OR REPLACE FUNCTION public.claim_path_register_entry(
  p_city_id text,
  p_walker_id uuid,
  p_tier text,
  p_display_name text,
  p_home_town text,
  p_first_visit_at timestamptz,
  p_completed_at timestamptz,
  p_days_elapsed integer,
  p_stops_total integer,
  p_verification text,
  p_is_public boolean
)
RETURNS public.path_register_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.path_register_entries;
  v_number integer;
  v_code text;
  v_result public.path_register_entries;
BEGIN
  IF p_tier NOT IN ('loop', 'four_seasons') THEN
    RAISE EXCEPTION 'unsupported register tier: %', p_tier;
  END IF;

  SELECT * INTO v_existing
    FROM public.path_register_entries
    WHERE walker_id = p_walker_id AND tier = p_tier;

  IF FOUND THEN
    -- Keep the number and the completion date; let a later, better-verified
    -- walk upgrade provenance and let the walker change their mind about
    -- appearing publicly.
    UPDATE public.path_register_entries
       SET display_name = COALESCE(p_display_name, display_name),
           home_town    = COALESCE(p_home_town, home_town),
           is_public    = p_is_public,
           verification = CASE
             WHEN verification = 'self_reported' AND p_verification IN ('verified', 'imported')
               THEN p_verification
             WHEN verification = 'imported' AND p_verification = 'verified'
               THEN 'verified'
             ELSE verification
           END,
           stops_total  = GREATEST(stops_total, COALESCE(p_stops_total, 0))
     WHERE id = v_existing.id
     RETURNING * INTO v_result;
    RETURN v_result;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('path_register:' || p_city_id || ':' || p_tier));

  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_number
    FROM public.path_register_entries
    WHERE city_id = p_city_id AND tier = p_tier;

  v_code := 'SP-'
    || CASE p_tier WHEN 'loop' THEN 'L' ELSE 'FS' END
    || '-' || lpad(v_number::text, 5, '0')
    || '-' || substr(md5(p_walker_id::text || p_tier), 1, 4);

  INSERT INTO public.path_register_entries (
    city_id, walker_id, tier, entry_number, display_name, home_town,
    first_visit_at, completed_at, days_elapsed, stops_total,
    verification, certificate_code, is_public
  ) VALUES (
    p_city_id, p_walker_id, p_tier, v_number, p_display_name, p_home_town,
    p_first_visit_at, COALESCE(p_completed_at, now()), p_days_elapsed,
    COALESCE(p_stops_total, 0), COALESCE(p_verification, 'self_reported'),
    v_code, COALESCE(p_is_public, false)
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Service role only. This function issues permanent numbers; nothing holding the
-- anon key should be able to call it.
REVOKE ALL ON FUNCTION public.claim_path_register_entry(
  text, uuid, text, text, text, timestamptz, timestamptz, integer, integer, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_path_register_entry(
  text, uuid, text, text, text, timestamptz, timestamptz, integer, integer, text, boolean
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_path_register_entry(
  text, uuid, text, text, text, timestamptz, timestamptz, integer, integer, text, boolean
) TO service_role;
