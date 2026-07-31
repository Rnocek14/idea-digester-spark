-- Notable walks — the superlative board, and where people linger.
--
-- The original ask was filters and sorts: hottest, fastest, largest group. Two
-- things shape what that can honestly be here.
--
-- 1. PRIVACY. anon has no grant on path_stop_visits and must not — a row there is
--    a named person's location at a moment in time. So this is a SECURITY DEFINER
--    aggregate like the almanac, and a walk carries a name ONLY when that walker
--    set is_public. Everyone else appears as "a walker". Nobody gets put on a
--    public board because they logged a walk.
--
-- 2. NOT RANKING SPEED. There is still no fastest-time board, for the reason
--    that has held since the beginning: this is a footpath through other
--    people's front yards. "Longest outing" and "most stops in a day" reward
--    covering ground, and "slowest" would reward lingering, which is the point of
--    the path. None of them reward running past somebody's porch.
--
-- A session_id groups one outing, so every metric below is per-outing rather
-- than per-stop except where noted.
CREATE OR REPLACE FUNCTION public.get_shore_path_notables(
  p_city_id text DEFAULT 'default',
  p_season text DEFAULT NULL,
  p_community text DEFAULT NULL,
  p_min_stops integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_min_stops integer := GREATEST(COALESCE(p_min_stops, 2), 2);
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT v.*, s.community, s.name AS stop_name, s.slug AS stop_slug, s.order_index
      FROM public.path_stop_visits v
      JOIN public.shore_path_stops s ON s.id = v.stop_id
     WHERE v.city_id = p_city_id
       AND s.is_published = true
       AND v.session_id IS NOT NULL
       AND (p_season IS NULL OR v.season = p_season)
  ),
  -- The shore filter selects outings that TOUCHED that shore; it does not clip
  -- them to it. Restricting the visits themselves meant "Linn" returned nothing
  -- unless somebody did two Linn stops in one outing, which is not what anyone
  -- clicking a shore chip is asking for — they want the walks that went there,
  -- described in full.
  eligible AS (
    SELECT DISTINCT session_id
      FROM base
     WHERE p_community IS NULL OR community = p_community
  ),
  filtered AS (
    SELECT b.* FROM base b JOIN eligible e ON e.session_id = b.session_id
  ),
  -- One row per outing. A session that only ever recorded a single stop is not
  -- a walk worth ranking, hence the floor.
  sessions AS (
    SELECT
      f.session_id,
      f.walker_id,
      COUNT(DISTINCT f.stop_id)                       AS stops,
      MIN(f.visited_at)                               AS started_at,
      MAX(f.visited_at)                               AS ended_at,
      EXTRACT(EPOCH FROM (MAX(f.visited_at) - MIN(f.visited_at)))::numeric AS seconds_on_path,
      MAX(f.temp_f)                                   AS peak_temp_f,
      MIN(f.temp_f)                                   AS low_temp_f,
      AVG(CASE f.crowd_level WHEN 'empty' THEN 0 WHEN 'some' THEN 1 WHEN 'busy' THEN 2 END) AS crowd_mean,
      MAX(f.group_size_band)                          AS group_size_band,
      MIN(f.hour_local)                               AS start_hour,
      MAX(f.hour_local)                               AS end_hour,
      MIN(f.visit_date)                               AS on_date,
      MIN(f.season)                                   AS season
    FROM filtered f
    GROUP BY f.session_id, f.walker_id
    HAVING COUNT(DISTINCT f.stop_id) >= v_min_stops
  ),
  -- Name only if the walker chose to be public.
  named AS (
    SELECT s.*,
           CASE WHEN w.is_public THEN w.display_name ELSE NULL END AS display_name,
           CASE WHEN w.is_public THEN w.home_town    ELSE NULL END AS home_town
      FROM sessions s
      LEFT JOIN public.path_walkers w ON w.id = s.walker_id
  ),
  -- Where people linger: within an outing, the gap from arriving at one stop to
  -- arriving at the next, attributed to the earlier stop. Gaps over four hours
  -- are somebody going home and coming back, not lingering.
  gaps AS (
    SELECT
      f.stop_slug,
      f.stop_name,
      f.community,
      EXTRACT(EPOCH FROM (
        LEAD(f.visited_at) OVER (PARTITION BY f.session_id ORDER BY f.visited_at) - f.visited_at
      ))::numeric AS gap_seconds
    FROM filtered f
  ),
  linger AS (
    SELECT stop_slug, stop_name, community,
           COUNT(*)                                                   AS samples,
           ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_seconds) / 60) AS median_minutes
      FROM gaps
     WHERE gap_seconds IS NOT NULL
       AND gap_seconds BETWEEN 60 AND 14400
     GROUP BY stop_slug, stop_name, community
    HAVING COUNT(*) >= 4
  )
  SELECT jsonb_build_object(
    'total_walks', (SELECT COUNT(*) FROM sessions),
    'min_stops', v_min_stops,
    'season', p_season,
    'community', p_community,

    'hottest',      (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, peak_temp_f AS temp_f FROM named WHERE peak_temp_f IS NOT NULL ORDER BY peak_temp_f DESC LIMIT 1) x),
    'coldest',      (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, low_temp_f  AS temp_f FROM named WHERE low_temp_f  IS NOT NULL ORDER BY low_temp_f  ASC  LIMIT 1) x),
    'busiest',      (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, ROUND(crowd_mean, 2) AS crowd_mean FROM named WHERE crowd_mean IS NOT NULL ORDER BY crowd_mean DESC LIMIT 1) x),
    'emptiest',     (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, ROUND(crowd_mean, 2) AS crowd_mean FROM named WHERE crowd_mean IS NOT NULL ORDER BY crowd_mean ASC  LIMIT 1) x),
    'largest_group',(SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, group_size_band FROM named WHERE group_size_band IS NOT NULL ORDER BY CASE group_size_band WHEN 'large' THEN 4 WHEN 'small' THEN 3 WHEN 'pair' THEN 2 ELSE 1 END DESC, stops DESC LIMIT 1) x),
    'most_stops',   (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops FROM named ORDER BY stops DESC, seconds_on_path ASC LIMIT 1) x),
    -- Longest time on the path, not shortest. Lingering is the point.
    'longest_outing',(SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, ROUND(seconds_on_path / 60) AS minutes FROM named WHERE seconds_on_path > 0 ORDER BY seconds_on_path DESC LIMIT 1) x),
    'earliest_start',(SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, start_hour FROM named WHERE start_hour IS NOT NULL ORDER BY start_hour ASC LIMIT 1) x),
    'latest_finish', (SELECT to_jsonb(x) FROM (SELECT display_name, home_town, on_date, season, stops, end_hour FROM named WHERE end_hour IS NOT NULL ORDER BY end_hour DESC LIMIT 1) x),

    'linger', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'stop_slug', stop_slug, 'stop_name', stop_name, 'community', community,
        'median_minutes', median_minutes, 'samples', samples
      ) ORDER BY median_minutes DESC)
      FROM linger
    ), '[]'::jsonb),

    'seasons_available', COALESCE((
      SELECT jsonb_agg(DISTINCT season ORDER BY season) FROM sessions WHERE season IS NOT NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_shore_path_notables(text, text, text, integer)
  TO anon, authenticated, service_role;

-- The window function and the session rollup both scan by session.
CREATE INDEX IF NOT EXISTS idx_path_stop_visits_session_time
  ON public.path_stop_visits (session_id, visited_at)
  WHERE session_id IS NOT NULL;
