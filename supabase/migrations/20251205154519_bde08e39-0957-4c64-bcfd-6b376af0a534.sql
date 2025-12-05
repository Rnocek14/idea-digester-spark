-- Fix Lake Geneva Patch URL (correct format)
UPDATE sources SET 
  url = 'https://patch.com/wisconsin/lake-geneva/rss.xml'
WHERE name = 'Lake Geneva Patch';

-- Deactivate rate-limited sources (use 'inactive' instead of 'paused')
UPDATE sources SET status = 'inactive' 
WHERE name IN ('Kenosha News - Walworth', 'Journal Times SE Wisconsin');

-- Add user-agent handling note for civic sources (403 issue)
UPDATE sources SET 
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{requires_browser_ua}', 'true'::jsonb)
WHERE name IN ('City of Lake Geneva – Civic Alerts', 'Lake Geneva City Calendar');