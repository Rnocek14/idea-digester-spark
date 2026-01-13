-- Clean up duplicate content_queue entries, keeping only the newest one per normalized_url
-- First mark all but the newest duplicate as 'duplicate' status
WITH duplicates AS (
  SELECT id,
         normalized_url,
         ROW_NUMBER() OVER (PARTITION BY normalized_url ORDER BY created_at DESC) as rn
  FROM content_queue
  WHERE normalized_url IS NOT NULL
)
UPDATE content_queue
SET status = 'expired'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now directly approve the 20 most recent pending safe stories
UPDATE content_queue
SET status = 'approved'
WHERE id IN (
  SELECT id FROM content_queue
  WHERE status = 'pending'
    AND safety_level = 'safe'
    AND created_at > now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 20
);