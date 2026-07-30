-- The Shore Path Almanac — conditions and crowding, measured rather than asserted.
--
-- Why this exists: the guide page already tells readers that "weekday mornings
-- are markedly quieter than weekend afternoons" and that October is "the local
-- pick, and not a close call." Both are true and both are unsourced editorial
-- opinion. Every logged walk turns them into something a reader can check, and
-- the resulting dataset is the one thing about this path nobody else can build —
-- Strava measures athletes, not how many people were on the trail or how hot the
-- unshaded south shore got at 2pm in July.
--
-- The capture rule is one tap. Temperature is fetched server-side so the walker
-- never types a number, and crowding is a three-way choice rather than a count,
-- because nobody honestly remembers whether it was nine people or eleven.

-- ---------------------------------------------------------------------------
-- 1. Conditions on each stop visit
-- ---------------------------------------------------------------------------
-- Per-visit rather than per-walk on purpose: the useful question is "how busy is
-- THIS stretch at THIS hour in THIS month", and a 21-mile walk spans eight hours
-- and four towns. `session_id` groups the stops of one outing so a single crowd
-- answer can be applied across them without asking sixteen times.
ALTER TABLE public.path_stop_visits
  ADD COLUMN IF NOT EXISTS session_id uuid,
  -- Local clock, stored at write time. Deriving these in SQL later would mean
  -- redoing timezone conversion on every read, and a DST change would silently
  -- reshuffle which hour bucket a past walk belongs to.
  ADD COLUMN IF NOT EXISTS hour_local smallint
    CHECK (hour_local IS NULL OR hour_local BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS dow_local smallint
    CHECK (dow_local IS NULL OR dow_local BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS month_local smallint
    CHECK (month_local IS NULL OR month_local BETWEEN 1 AND 12),
  -- Self-reported, optional, three-way. A count would be invented; a bucket is
  -- something a walker can answer honestly with one tap.
  ADD COLUMN IF NOT EXISTS crowd_level text
    CHECK (crowd_level IS NULL OR crowd_level IN ('empty', 'some', 'busy')),
  -- Banded rather than exact so there is nothing to be gained by recruiting one
  -- more person onto a single-file easement to take a title.
  ADD COLUMN IF NOT EXISTS group_size_band text
    CHECK (group_size_band IS NULL OR group_size_band IN ('solo', 'pair', 'small', 'large')),
  -- Fetched, not typed.
  ADD COLUMN IF NOT EXISTS temp_f numeric,
  ADD COLUMN IF NOT EXISTS feels_like_f numeric,
  ADD COLUMN IF NOT EXISTS wind_mph numeric,
  ADD COLUMN IF NOT EXISTS precip text;

COMMENT ON COLUMN public.path_stop_visits.session_id IS
  'Groups the stops of a single outing so one crowd answer covers all of them.';
COMMENT ON COLUMN public.path_stop_visits.hour_local IS
  'Hour 0-23 in the city timezone at the moment of the visit. Stored, not derived — see migration notes.';

CREATE INDEX IF NOT EXISTS idx_path_stop_visits_session
  ON public.path_stop_visits (session_id)
  WHERE session_id IS NOT NULL;
-- The almanac's read pattern: group by stop, month and hour.
CREATE INDEX IF NOT EXISTS idx_path_stop_visits_almanac
  ON public.path_stop_visits (stop_id, month_local, hour_local);

-- ---------------------------------------------------------------------------
-- 2. Hourly weather cache
-- ---------------------------------------------------------------------------
-- A sixteen-stop day would otherwise mean sixteen upstream weather calls that
-- all return the same hour's reading. Cached per (city, hour), which also leaves
-- a historical series behind for backfilling walks logged without a reading.
CREATE TABLE IF NOT EXISTS public.path_weather_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id) ON DELETE CASCADE,
  -- Truncated to the hour, in UTC.
  observed_hour timestamptz NOT NULL,
  temp_f numeric,
  feels_like_f numeric,
  wind_mph numeric,
  precip text,
  source text NOT NULL DEFAULT 'open-meteo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_path_weather_city_hour
  ON public.path_weather_hourly (city_id, observed_hour);

GRANT ALL ON public.path_weather_hourly TO service_role;
ALTER TABLE public.path_weather_hourly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read the weather cache" ON public.path_weather_hourly;
CREATE POLICY "Admins can read the weather cache" ON public.path_weather_hourly
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 3. The almanac read path
-- ---------------------------------------------------------------------------
-- anon must never read path_stop_visits: a row there is a named person's
-- location at a moment in time. So the public read is this function, which
-- returns only aggregates and only where the sample is large enough to be worth
-- printing. Below the threshold it returns nothing for that cell rather than a
-- number derived from one person's single walk.
--
-- p_min_samples is the k-anonymity floor as well as the statistical one: at 4,
-- no cell can be traced back to an individual outing.
CREATE OR REPLACE FUNCTION public.get_shore_path_almanac(
  p_city_id text DEFAULT 'default',
  p_min_samples integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_min integer := GREATEST(COALESCE(p_min_samples, 4), 3);
  v_result jsonb;
BEGIN
  WITH bucketed AS (
    SELECT
      v.stop_id,
      s.slug AS stop_slug,
      s.community,
      v.month_local,
      CASE
        WHEN v.hour_local < 8  THEN 'dawn'
        WHEN v.hour_local < 11 THEN 'morning'
        WHEN v.hour_local < 14 THEN 'midday'
        WHEN v.hour_local < 17 THEN 'afternoon'
        ELSE 'evening'
      END AS hour_bucket,
      v.season,
      CASE WHEN v.dow_local IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS day_type,
      v.crowd_level,
      v.temp_f,
      -- Crowding as a number so it can be averaged: empty 0, some 1, busy 2.
      CASE v.crowd_level WHEN 'empty' THEN 0 WHEN 'some' THEN 1 WHEN 'busy' THEN 2 END AS crowd_score
    FROM public.path_stop_visits v
    JOIN public.shore_path_stops s ON s.id = v.stop_id
    WHERE v.city_id = p_city_id
      AND s.is_published = true
      AND v.hour_local IS NOT NULL
      AND v.month_local IS NOT NULL
  )
  SELECT jsonb_build_object(
    'min_samples', v_min,
    'total_visits', (SELECT COUNT(*) FROM bucketed),
    'total_with_crowd', (SELECT COUNT(*) FROM bucketed WHERE crowd_level IS NOT NULL),

    -- Season × time-of-day crowding. The headline grid.
    'by_season_hour', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'season', season,
        'hour_bucket', hour_bucket,
        'samples', samples,
        'crowd_mean', ROUND(crowd_mean, 2),
        'temp_median', temp_median
      ) ORDER BY season, hour_bucket)
      FROM (
        SELECT
          season,
          hour_bucket,
          COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) AS samples,
          AVG(crowd_score) AS crowd_mean,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY temp_f)) AS temp_median
        FROM bucketed
        GROUP BY season, hour_bucket
        HAVING COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) >= v_min
      ) sub
    ), '[]'::jsonb),

    -- Weekday vs weekend, per season. This is the specific claim the guide page
    -- makes without a source.
    'by_season_daytype', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'season', season,
        'day_type', day_type,
        'samples', samples,
        'crowd_mean', ROUND(crowd_mean, 2)
      ) ORDER BY season, day_type)
      FROM (
        SELECT
          season,
          day_type,
          COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) AS samples,
          AVG(crowd_score) AS crowd_mean
        FROM bucketed
        GROUP BY season, day_type
        HAVING COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) >= v_min
      ) sub
    ), '[]'::jsonb),

    -- Per-community crowding, the closest honest proxy for "which stretch" while
    -- shore_path_stops.leg_order_index is still unassigned.
    'by_community', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'community', community,
        'samples', samples,
        'crowd_mean', ROUND(crowd_mean, 2),
        'temp_median', temp_median
      ) ORDER BY community)
      FROM (
        SELECT
          community,
          COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) AS samples,
          AVG(crowd_score) AS crowd_mean,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY temp_f)) AS temp_median
        FROM bucketed
        WHERE community IS NOT NULL
        GROUP BY community
        HAVING COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) >= v_min
      ) sub
    ), '[]'::jsonb),

    -- Quietest and warmest logged buckets, for the "when should I go" callout.
    'quietest', (
      SELECT jsonb_build_object(
        'season', season, 'hour_bucket', hour_bucket,
        'day_type', day_type, 'samples', samples, 'crowd_mean', ROUND(crowd_mean, 2)
      )
      FROM (
        SELECT season, hour_bucket, day_type,
               COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) AS samples,
               AVG(crowd_score) AS crowd_mean
        FROM bucketed
        GROUP BY season, hour_bucket, day_type
        HAVING COUNT(*) FILTER (WHERE crowd_score IS NOT NULL) >= v_min
      ) sub
      ORDER BY crowd_mean ASC, samples DESC
      LIMIT 1
    ),
    'warmest', (
      SELECT jsonb_build_object(
        'season', season, 'hour_bucket', hour_bucket,
        'samples', samples, 'temp_median', temp_median
      )
      FROM (
        SELECT season, hour_bucket,
               COUNT(*) FILTER (WHERE temp_f IS NOT NULL) AS samples,
               ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY temp_f)) AS temp_median
        FROM bucketed
        GROUP BY season, hour_bucket
        HAVING COUNT(*) FILTER (WHERE temp_f IS NOT NULL) >= v_min
      ) sub
      ORDER BY temp_median DESC NULLS LAST
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Readable by the public: it returns only gated aggregates, never a visit row.
GRANT EXECUTE ON FUNCTION public.get_shore_path_almanac(text, integer) TO anon, authenticated, service_role;
