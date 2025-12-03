-- Add civic auto-publish rule (if not exists)
INSERT INTO auto_publish_rules (category, action, enabled)
VALUES ('civic', 'auto_publish', true)
ON CONFLICT DO NOTHING;

-- Backfill ONLY civic + community safe stories to auto_published
-- This preserves news for manual review as intended
UPDATE content_queue 
SET status = 'auto_published',
    updated_at = now()
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND category IN ('civic', 'community');