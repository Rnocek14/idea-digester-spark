
-- Mark duplicate nightlife events as rejected (keeping the best one per title)
WITH ranked_events AS (
  SELECT 
    id,
    title,
    ROW_NUMBER() OVER (
      PARTITION BY title 
      ORDER BY 
        CASE WHEN performer IS NOT NULL AND event_time IS NOT NULL THEN 3
             WHEN performer IS NOT NULL THEN 2
             WHEN event_time IS NOT NULL THEN 1
             ELSE 0 END DESC,
        created_at DESC
    ) as rn
  FROM content_queue
  WHERE metadata->>'verticals' LIKE '%nightlife%'
    AND status IN ('published', 'auto_published', 'approved', 'pending')
)
UPDATE content_queue
SET status = 'rejected'
WHERE id IN (SELECT id FROM ranked_events WHERE rn > 1);
