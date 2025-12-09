
-- Clean up stuck pending X posts with past scheduled dates
DELETE FROM post_queue 
WHERE status = 'pending' 
  AND platform = 'x'
  AND scheduled_for < now();
