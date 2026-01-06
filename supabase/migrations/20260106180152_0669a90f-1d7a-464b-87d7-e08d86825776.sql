-- Fix stale/bad event data (event_date in 1956 is clearly a parsing error)
UPDATE content_queue 
SET status = 'rejected', 
    safety_reason = 'Invalid event date - data parsing error'
WHERE event_date IS NOT NULL 
  AND event_date < '2020-01-01';

-- Enable Facebook and Instagram posting
UPDATE system_settings 
SET value = jsonb_set(
  jsonb_set(value::jsonb, '{facebook_enabled}', 'true'),
  '{instagram_enabled}', 'true'
),
updated_at = NOW()
WHERE key = 'automation';

-- Deactivate broken/stale sources that haven't been fetched
UPDATE sources 
SET status = 'inactive'
WHERE status = 'error' 
   OR (last_fetched_at IS NULL AND created_at < NOW() - INTERVAL '7 days')
   OR (last_fetched_at < NOW() - INTERVAL '30 days' AND status != 'inactive');