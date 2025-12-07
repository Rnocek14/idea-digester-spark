-- Delete duplicate posts, keeping only the first one (by status priority: sent > simulated > pending, then earliest scheduled_for)
DELETE FROM post_queue
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY story_id, platform ORDER BY 
        CASE status 
          WHEN 'sent' THEN 1 
          WHEN 'simulated' THEN 2 
          WHEN 'pending' THEN 3 
        END,
        scheduled_for ASC
      ) as rn
    FROM post_queue
    WHERE status IN ('pending', 'sent', 'simulated')
  ) ranked
  WHERE rn > 1
);

-- Now create the unique partial index
CREATE UNIQUE INDEX idx_post_queue_story_platform_unique 
ON post_queue (story_id, platform) 
WHERE status IN ('pending', 'sent', 'simulated');