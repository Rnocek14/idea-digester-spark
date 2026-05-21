
-- Backfill canonical link onto pending X / Facebook posts
WITH targets AS (
  SELECT
    pq.id,
    pq.platform,
    pq.post_text,
    LOWER(COALESCE(cq.category, '')) AS cat
  FROM public.post_queue pq
  LEFT JOIN public.content_queue cq ON cq.id = pq.story_id
  WHERE pq.status = 'pending'
    AND pq.platform IN ('x', 'facebook')
    AND pq.post_text !~* 'citybrief\.info'
),
linked AS (
  SELECT
    id,
    platform,
    post_text,
    CASE cat
      WHEN 'nightlife' THEN 'https://lakegeneva.citybrief.info/nightlife'
      WHEN 'dining' THEN 'https://lakegeneva.citybrief.info/eats'
      WHEN 'incidents' THEN 'https://lakegeneva.citybrief.info/incidents'
      WHEN 'public_safety' THEN 'https://lakegeneva.citybrief.info/incidents'
      WHEN 'jobs' THEN 'https://lakegeneva.citybrief.info/jobs'
      WHEN 'deals' THEN 'https://lakegeneva.citybrief.info/deals'
      ELSE 'https://lakegeneva.citybrief.info'
    END AS link
  FROM targets
)
UPDATE public.post_queue p
SET post_text = CASE
  WHEN l.platform = 'x' AND length(l.post_text) + length(l.link) + 1 > 280
    THEN rtrim(substring(l.post_text from 1 for 280 - length(l.link) - 2)) || '…' || E'\n' || l.link
  WHEN l.platform = 'x'
    THEN l.post_text || E'\n' || l.link
  ELSE l.post_text || E'\n\n' || l.link
END
FROM linked l
WHERE p.id = l.id;
