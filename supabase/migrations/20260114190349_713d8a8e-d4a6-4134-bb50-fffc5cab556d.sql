-- SYSTEM RECOVERY: Bulk approve pending safe content
-- Approve all pending safe stories in events, community, dining categories from last 30 days

UPDATE content_queue
SET status = 'auto_published',
    reviewed_at = now()
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND category IN ('events', 'community', 'dining', 'food', 'restaurant')
  AND created_at > now() - interval '30 days';

-- Also approve weather and traffic content (always safe)
UPDATE content_queue
SET status = 'auto_published',
    reviewed_at = now()
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND category IN ('weather', 'traffic')
  AND created_at > now() - interval '14 days';

-- Clean up duplicate auto-publish rules (keep only requires_hyperlocal = false)
DELETE FROM auto_publish_rules
WHERE category IN ('events', 'community', 'dining')
  AND requires_hyperlocal = true
  AND source_id IS NULL;

-- Mark broken/erroring sources as inactive
UPDATE sources
SET status = 'inactive'
WHERE status = 'error'
  AND type IN ('rss', 'scrape', 'diy-scrape')
  AND (category ILIKE '%dining%' OR category ILIKE '%food%' OR category ILIKE '%restaurant%');