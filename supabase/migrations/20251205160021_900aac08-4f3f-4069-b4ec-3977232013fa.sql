-- Add geo_tier and geo_label columns for hyperlocal filtering
ALTER TABLE content_queue 
  ADD COLUMN IF NOT EXISTS geo_tier smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geo_label text;

-- Add default_geo_tier to sources for known-local sources
ALTER TABLE sources 
  ADD COLUMN IF NOT EXISTS default_geo_tier smallint DEFAULT 0;

-- Set default geo tiers for existing sources
UPDATE sources SET default_geo_tier = 1 WHERE name ILIKE '%lake geneva%' OR name ILIKE '%visit lake geneva%';
UPDATE sources SET default_geo_tier = 2 WHERE name ILIKE '%walworth%' OR name ILIKE '%fox6%' OR name ILIKE '%tmj4%';

-- Create index for efficient geo filtering
CREATE INDEX IF NOT EXISTS idx_content_queue_geo_tier ON content_queue(geo_tier);

-- Backfill existing stories with geo_tier based on title/summary keyword matching
UPDATE content_queue SET geo_tier = 1, geo_label = 'Lake Geneva'
WHERE (LOWER(title) LIKE '%lake geneva%' OR LOWER(summary) LIKE '%lake geneva%'
  OR LOWER(title) LIKE '%geneva lake%' OR LOWER(summary) LIKE '%geneva lake%'
  OR LOWER(title) LIKE '%williams bay%' OR LOWER(summary) LIKE '%williams bay%'
  OR LOWER(title) LIKE '%fontana%' OR LOWER(summary) LIKE '%fontana%')
  AND geo_tier = 0;

UPDATE content_queue SET geo_tier = 2, geo_label = 'Walworth County'
WHERE (LOWER(title) LIKE '%walworth%' OR LOWER(summary) LIKE '%walworth%'
  OR LOWER(title) LIKE '%delavan%' OR LOWER(summary) LIKE '%delavan%'
  OR LOWER(title) LIKE '%elkhorn%' OR LOWER(summary) LIKE '%elkhorn%')
  AND geo_tier = 0;