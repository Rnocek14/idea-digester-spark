-- First, add 'expired' and 'blocked' to the valid status values
ALTER TABLE post_queue DROP CONSTRAINT post_queue_status_check;

ALTER TABLE post_queue ADD CONSTRAINT post_queue_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'simulated'::text, 'expired'::text, 'blocked'::text]));

-- Now expire pending posts for past events
UPDATE post_queue 
SET status = 'expired', 
    error_message = 'Event date has passed - auto-expired during cleanup'
WHERE status = 'pending' 
AND story_id IN (
  SELECT id FROM content_queue 
  WHERE event_date < CURRENT_DATE
);

-- Expire pending Christmas/Santa/holiday posts (it's January)
UPDATE post_queue
SET status = 'expired',
    error_message = 'Holiday content expired - season has passed'
WHERE status = 'pending'
AND (
  post_text ILIKE '%santa%' 
  OR post_text ILIKE '%christmas%'
  OR post_text ILIKE '%holiday parade%'
);