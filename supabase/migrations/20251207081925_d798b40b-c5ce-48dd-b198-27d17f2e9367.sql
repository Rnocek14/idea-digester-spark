DELETE FROM post_queue 
WHERE status = 'pending' 
AND EXISTS (
  SELECT 1 FROM post_queue sent 
  WHERE sent.story_id = post_queue.story_id 
  AND sent.platform = post_queue.platform 
  AND sent.status IN ('sent', 'simulated')
)