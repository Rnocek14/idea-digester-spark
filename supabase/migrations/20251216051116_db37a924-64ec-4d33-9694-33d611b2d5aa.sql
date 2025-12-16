-- Mark ALL remaining publishable duplicates (any category)
WITH ranked AS (
  SELECT
    id,
    normalized_url,
    created_at,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_url
      ORDER BY created_at ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY normalized_url
      ORDER BY created_at ASC
    ) AS canonical_id
  FROM content_queue
  WHERE normalized_url IS NOT NULL
    AND status IN ('approved', 'auto_published', 'published')
)
UPDATE content_queue cq
SET
  status = 'pending',
  metadata = COALESCE(cq.metadata, '{}'::jsonb) || jsonb_build_object(
    'duplicate_of', ranked.canonical_id,
    'duplicate_reason', 'normalized_url',
    'duplicate_marked_at', now()
  )
FROM ranked
WHERE cq.id = ranked.id
  AND ranked.rn > 1
  AND cq.status IN ('approved', 'auto_published', 'published');