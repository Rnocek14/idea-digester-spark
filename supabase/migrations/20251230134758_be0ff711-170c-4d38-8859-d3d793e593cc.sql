-- =====================================================
-- SYSTEM HEALTH REMEDIATION MIGRATION
-- =====================================================

-- 1. FIX MAXWELL MANSION FLOODING
-- Reduce sync frequency from 180 min to 1440 min (daily)
-- Add review_mode to prevent auto-publishing duplicates
UPDATE sources
SET 
  fetch_frequency_minutes = 1440,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'review_mode', true,
    'frequency_reduced_at', now()::text,
    'frequency_reduced_reason', 'duplicate_flooding'
  )
WHERE name = 'Maxwell Mansion';

-- 2. AUTO-PUBLISH DINING CONTENT
-- Create rule for dining category with hyperlocal requirement
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES (null, 'dining', 'auto_publish', true, true)
ON CONFLICT DO NOTHING;

-- 3. CLEAN UP PENDING BACKLOG

-- 3a. Reject non-hyperlocal news (geo_tier = 0 means not local)
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now()
WHERE 
  status = 'pending'
  AND category = 'news'
  AND (geo_tier = 0 OR geo_tier IS NULL)
  AND created_at < now() - interval '7 days';

-- 3b. Identify and reject duplicate events from Maxwell Mansion
-- Keep the most recent of each unique title, reject others
WITH duplicate_events AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        regexp_replace(lower(title), '[^a-z0-9]', '', 'g'),
        source_id
      ORDER BY created_at DESC
    ) as rn
  FROM content_queue
  WHERE source_id IN (SELECT id FROM sources WHERE name = 'Maxwell Mansion')
    AND status = 'pending'
)
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now()
WHERE id IN (
  SELECT id FROM duplicate_events WHERE rn > 1
);

-- 3c. Reject very old pending items (30+ days)
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now()
WHERE 
  status = 'pending'
  AND created_at < now() - interval '30 days';