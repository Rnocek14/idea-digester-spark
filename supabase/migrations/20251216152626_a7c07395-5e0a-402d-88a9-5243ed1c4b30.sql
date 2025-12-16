
-- Re-activate Patch Lake Geneva in pending-review mode with hyperlocal gating
UPDATE sources
SET 
  status = 'active',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'reactivated_at', now()::text,
    'review_mode', true,
    'uses_firecrawl', true,
    'auto_publish_disabled', true
  )
WHERE name = 'Patch Lake Geneva';

-- Add source-specific auto-publish rules for Patch (all require hyperlocal + needs_review)
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
SELECT 
  s.id,
  cats.category,
  'needs_review',
  true,
  true
FROM sources s
CROSS JOIN (VALUES ('news'), ('community'), ('civic'), ('events')) AS cats(category)
WHERE s.name = 'Patch Lake Geneva'
ON CONFLICT DO NOTHING;
