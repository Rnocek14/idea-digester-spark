-- Fix hyperlocal gate leaks: move non-hyperlocal TMJ4 items out of auto_published
UPDATE content_queue cq
SET status = 'pending'
FROM sources s
WHERE cq.source_id = s.id
  AND cq.status = 'auto_published'
  AND COALESCE(cq.geo_tier, 0) < 1
  AND cq.category IN ('events','community','civic','weather')
  AND s.name ILIKE '%tmj4%'
  AND cq.created_at > now() - interval '14 days';