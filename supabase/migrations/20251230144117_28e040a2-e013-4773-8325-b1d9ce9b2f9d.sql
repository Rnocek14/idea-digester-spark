
-- Fix TMJ4 Regional flooding: reduce sync to daily and reject old pending items

-- 1. Update TMJ4 Regional fetch frequency to daily (1440 minutes)
UPDATE sources 
SET fetch_frequency_minutes = 1440 
WHERE id = 'fdaff72a-45b8-4248-8d1d-5afdae638487';

-- 2. Reject pending TMJ4 Regional items older than 3 days
UPDATE content_queue
SET status = 'rejected',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"rejection_reason": "Auto-rejected: regional news older than 3 days"}'::jsonb
WHERE source_id = 'fdaff72a-45b8-4248-8d1d-5afdae638487'
  AND status = 'pending'
  AND created_at < now() - interval '3 days';
