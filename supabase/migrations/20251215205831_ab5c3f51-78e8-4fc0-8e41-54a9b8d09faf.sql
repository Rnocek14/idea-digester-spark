-- Fix 1: Tighten global civic rule (prevent future regional civic leakage)
UPDATE auto_publish_rules
SET requires_hyperlocal = true
WHERE source_id IS NULL
  AND category = 'civic'
  AND enabled = true;

-- Fix 2: Clean TMJ4 metadata inconsistency (align with column value)
UPDATE sources
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{default_geo_tier}',
  '0'::jsonb,
  true
)
WHERE name ILIKE '%tmj4%';