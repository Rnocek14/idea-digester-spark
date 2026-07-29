-- Paste into the Supabase SQL editor and run all at once.
-- Runs as service role, so RLS does NOT apply here. Compare with /debug/feed
-- (which runs as the public key, WITH RLS):
--
--   SQL shows rows + /debug/feed shows 0  -> RLS is hiding content from readers
--   SQL shows 0     + /debug/feed shows 0  -> the ingestion pipeline is starved
--
-- 1) Do the multi-city columns exist yet?
SELECT 'schema' AS check,
       to_regclass('public.city_config')                                    AS city_config_table,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'content_queue' AND column_name = 'city_id')    AS content_queue_has_city_id,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'incidents' AND column_name = 'city_id')        AS incidents_has_city_id;

-- 2) What is actually in content_queue?
SELECT 'totals' AS check,
       count(*)                                                        AS all_rows,
       count(*) FILTER (WHERE status IN ('published','auto_published')) AS published_rows,
       count(*) FILTER (WHERE publish_date IS NULL)                     AS null_publish_date,
       count(*) FILTER (WHERE created_at > now() - interval '14 days')  AS created_last_14d,
       count(*) FILTER (WHERE publish_date > now())                     AS future_dated,
       max(created_at)                                                  AS newest_row,
       max(publish_date)                                                AS newest_publish_date
FROM public.content_queue;

-- 3) Breakdown of everything published in the last 30 days.
SELECT status, safety_level, geo_tier, count(*) AS rows, max(created_at) AS newest
FROM public.content_queue
WHERE created_at > now() - interval '30 days'
GROUP BY 1,2,3
ORDER BY rows DESC;

-- 4) The EXACT homepage query, as a count. If this is 0, the homepage is empty.
SELECT 'homepage_query' AS check, count(*) AS rows_the_homepage_would_show
FROM public.content_queue
WHERE status IN ('published','auto_published')
  AND safety_level IN ('safe','soft_sensitive')
  AND geo_tier BETWEEN 0 AND 2
  AND created_at   >= now() - interval '14 days'
  AND publish_date >= now() - interval '14 days'
  AND publish_date <= now();

-- 5) Same query WITHOUT the publish_date window (isolates NULL/stale dates).
SELECT 'without_publish_date_filter' AS check, count(*) AS rows
FROM public.content_queue
WHERE status IN ('published','auto_published')
  AND safety_level IN ('safe','soft_sensitive')
  AND geo_tier BETWEEN 0 AND 2
  AND created_at >= now() - interval '14 days';

-- 6) Is the public (anon) RLS policy still in place on content_queue?
SELECT 'rls' AS check, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'content_queue';

-- 7) Is the ingestion pipeline alive? (Which sources produced anything lately.)
SELECT status, count(*) AS sources,
       count(*) FILTER (WHERE last_successful_fetch_at > now() - interval '2 days') AS fetched_ok_48h,
       count(*) FILTER (WHERE last_nonzero_run_at      > now() - interval '7 days') AS produced_items_7d,
       max(last_nonzero_run_at)                                                     AS last_item_anywhere
FROM public.sources
GROUP BY status
ORDER BY sources DESC;

-- 8) Top sources by recency — who is actually still feeding the site?
SELECT name, status, type, consecutive_zero_runs,
       last_successful_fetch_at, last_nonzero_run_at, last_error_code
FROM public.sources
WHERE status = 'active'
ORDER BY last_nonzero_run_at DESC NULLS LAST
LIMIT 15;

-- 9) Did the cron jobs actually get created, and are they running?
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
