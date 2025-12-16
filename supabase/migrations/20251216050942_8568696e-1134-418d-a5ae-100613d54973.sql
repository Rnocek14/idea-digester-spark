-- Mark duplicates safely (keep earliest record per normalized_url, mark rest as pending with metadata)
-- This targets events category with safe/hyperlocal content from last 30 days

WITH ranked AS (
  SELECT
    id,
    normalized_url,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_url
      ORDER BY created_at ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY normalized_url
      ORDER BY created_at ASC
    ) AS canonical_id
  FROM content_queue
  WHERE created_at > now() - interval '30 days'
    AND normalized_url IS NOT NULL
    AND category = 'events'
    AND (safety_level = 'safe' OR safety_level IS NULL)
    AND COALESCE(geo_tier, 0) >= 1
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
  AND ranked.rn > 1;

-- Create unique partial index to prevent future duplicates on publishable content
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_queue_normalized_url_publishable
ON content_queue (normalized_url)
WHERE normalized_url IS NOT NULL
  AND status IN ('approved', 'auto_published', 'published');