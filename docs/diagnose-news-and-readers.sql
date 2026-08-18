-- Two questions this file answers, against live production data.
-- Run in the Supabase SQL editor (service role). Read-only; nothing here writes.
--
--   1. Are we publishing enough news?
--   2. Is anyone actually reading it — and are they people or bots?
--
-- Both are production-data questions. They cannot be answered from the codebase,
-- which is why this file exists rather than a claim in a report.

-- ---------------------------------------------------------------------------
-- 1. NEWS VOLUME — is the pipeline actually producing?
-- ---------------------------------------------------------------------------

-- Stories published per day for the last 30 days. The shape matters more than any
-- single day: a healthy local feed is a low, steady line, not spikes and zeros.
SELECT date_trunc('day', COALESCE(publish_date, created_at))::date AS day,
       count(*) FILTER (WHERE status IN ('published','auto_published')) AS published,
       count(*) FILTER (WHERE status = 'pending_review')               AS held,
       count(*) FILTER (WHERE status = 'rejected')                     AS rejected
FROM content_queue
WHERE COALESCE(publish_date, created_at) > now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- What is actually live on the site RIGHT NOW — this is the homepage's own filter.
-- If this is near zero the site looks empty regardless of how much was ingested.
SELECT count(*) AS live_on_homepage
FROM content_queue
WHERE status IN ('published','auto_published')
  AND safety_level IN ('safe','soft_sensitive')
  AND geo_tier BETWEEN 1 AND 2  -- 0 = regional, excluded
  AND publish_date BETWEEN now() - interval '14 days' AND now();

-- Mix by category. One category dominating usually means one source is carrying
-- the whole feed, which is fragile — if it breaks, the site goes quiet.
SELECT category, count(*) AS stories, max(publish_date) AS most_recent
FROM content_queue
WHERE status IN ('published','auto_published')
  AND publish_date > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;

-- Source health. A source that has not produced in 14 days is effectively dead,
-- whatever its status column says.
SELECT name, status, last_success_at,
       date_part('day', now() - last_success_at)::int AS days_since_success
FROM sources
ORDER BY last_success_at NULLS FIRST
LIMIT 40;

-- ---------------------------------------------------------------------------
-- 2. READERS — people, or bots?
-- ---------------------------------------------------------------------------
-- NOTE: page-level tracking was only wired up on 2026-07-29. Rows before that date
-- cover just two homepage blocks, so do not read history from this table yet.

-- The headline number. detail_view means a browser opened the page.
-- detail_read_complete means it stayed 20s AND scrolled past halfway.
-- The gap between them is the honest bot signal: automation produces the first
-- and almost never the second.
SELECT date_trunc('day', occurred_at)::date AS day,
       count(*) FILTER (WHERE event_type = 'detail_view')          AS views,
       count(*) FILTER (WHERE event_type = 'detail_read_complete') AS reads,
       round(100.0 * count(*) FILTER (WHERE event_type = 'detail_read_complete')
             / NULLIF(count(*) FILTER (WHERE event_type = 'detail_view'), 0), 1) AS read_pct
FROM story_events
WHERE occurred_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Distinct sessions per day. A session id is a random localStorage value, so most
-- crawlers never produce one at all — a low number here alongside high server
-- traffic means the traffic is not human.
SELECT date_trunc('day', occurred_at)::date AS day,
       count(DISTINCT session_id) AS sessions
FROM story_events
WHERE occurred_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;

-- RETURNING readers — the single most trustworthy signal on this list.
-- Bots do not come back under the same localStorage id days later. Humans do.
SELECT count(*) AS returning_sessions
FROM (
  SELECT session_id
  FROM story_events
  WHERE occurred_at > now() - interval '30 days' AND session_id NOT IN ('ssr','anon')
  GROUP BY session_id
  HAVING count(DISTINCT date_trunc('day', occurred_at)) >= 2
) s;

-- Where readers come from. Empty referrer dominating is normal (direct + apps),
-- but search referrers are the proof that the SEO work is reaching anyone.
SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer, count(*) AS events
FROM story_events
WHERE occurred_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 25;

-- Which pages actually get read through. This is the list that should drive what
-- gets written next — and the guides finally appear here now that they are tracked.
SELECT path,
       count(*) FILTER (WHERE event_type = 'detail_view')          AS views,
       count(*) FILTER (WHERE event_type = 'detail_read_complete') AS reads
FROM story_events
WHERE occurred_at > now() - interval '30 days' AND path IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 30;
