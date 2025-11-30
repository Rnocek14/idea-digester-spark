-- Fix content_queue status constraint to include all valid status values
-- Drop the existing constraint that only allows 4 statuses
ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_status_check;

-- Add new constraint with all 7 valid status values
ALTER TABLE content_queue ADD CONSTRAINT content_queue_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'auto_published', 'flagged', 'blocked'));