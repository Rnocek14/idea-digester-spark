-- Add 'expired' to content_queue status check constraint
ALTER TABLE content_queue DROP CONSTRAINT content_queue_status_check;
ALTER TABLE content_queue ADD CONSTRAINT content_queue_status_check 
CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected', 'published', 'auto_published', 'flagged', 'blocked', 'expired']));

-- Now cleanup duplicate events, keeping only the oldest one per title+source
WITH duplicates AS (
  SELECT id, title, source_id, status, created_at,
    ROW_NUMBER() OVER (PARTITION BY title, source_id ORDER BY created_at ASC) as rn
  FROM content_queue
  WHERE category = 'events'
)
UPDATE content_queue
SET status = 'expired', updated_at = NOW()
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);