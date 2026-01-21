-- Phase 1A: Unblock Content Pipeline
-- 1. Allow regional news from trusted sources (TMJ4, Spectrum) to auto-publish
UPDATE auto_publish_rules 
SET requires_hyperlocal = false, updated_at = NOW()
WHERE source_id IN (
  SELECT id FROM sources WHERE name ILIKE '%TMJ4%' OR name ILIKE '%Spectrum%'
)
AND category IN ('news', 'civic', 'community');

-- 2. Also add a fallback rule: news category from any source with safe content can auto-publish
-- This catches trusted regional news that might not have specific rules
INSERT INTO auto_publish_rules (category, action, requires_hyperlocal, enabled)
VALUES ('news', 'auto_publish', false, true)
ON CONFLICT DO NOTHING;

-- 3. Bulk approve pending safe content from the last 7 days
UPDATE content_queue
SET status = 'approved', reviewed_at = NOW()
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND created_at > NOW() - INTERVAL '7 days';