
-- Fix House of Music - Events (update URL, reset status)
UPDATE sources SET 
  status = 'active',
  url = 'https://www.lghom.com/live-entertainment',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb) - 'disabled_at' - 'disabled_reason' - 'consecutive_failures',
    '{expected_verticals}',
    '["nightlife"]'::jsonb
  ),
  category = 'nightlife'
WHERE id = 'b7d52234-03b3-45c4-8cdb-ab80fa815ab6';

-- Fix Hogs and Kisses Saloon (correct URL is hogsandkisses.com, not hogsandkissessaloon.com)
UPDATE sources SET 
  status = 'active',
  url = 'https://www.hogsandkisses.com/at-a-glance',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb) - 'disabled_at' - 'disabled_reason' - 'consecutive_failures',
    '{expected_verticals}',
    '["nightlife"]'::jsonb
  ),
  category = 'nightlife'
WHERE id = '383ac3fa-89f6-48ca-9b9a-9d6231d584e1';

-- Fix Gordy's Boat House - Events (reset status, it had error)
UPDATE sources SET 
  status = 'active',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb) - 'disabled_at' - 'disabled_reason' - 'consecutive_failures',
    '{expected_verticals}',
    '["nightlife", "eats"]'::jsonb
  ),
  category = 'nightlife'
WHERE id = 'b6dc0d3d-2555-4607-988a-9c2d5d773b1d';

-- Update Chucks Lakeshore Inn to include nightlife vertical
UPDATE sources SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{expected_verticals}',
    '["eats", "nightlife"]'::jsonb
  )
WHERE id = '232ec20a-aecd-4517-9edb-da58a47a5085';

-- Update DJs in the Drink to have nightlife vertical
UPDATE sources SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{expected_verticals}',
    '["nightlife"]'::jsonb
  ),
  category = 'nightlife'
WHERE id = 'fce15a32-4596-48b3-8bb7-005a12bc62de';

-- Update Thumbs Up Pub to have nightlife vertical
UPDATE sources SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{expected_verticals}',
    '["nightlife"]'::jsonb
  ),
  category = 'nightlife'
WHERE id = '4f4aaf91-1450-469d-b8bc-c9a6e2de3d41';

-- Disable duplicate Hogs and Kisses sources (keep the one we just fixed)
UPDATE sources SET status = 'inactive' 
WHERE id IN ('b2ca808e-65f1-44ee-a75d-5984887abb5c', '720e89e9-b5ea-466a-83ca-2b8dcbab75dd');

-- Add Papa's Blue Spruce Resort
INSERT INTO sources (name, url, type, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Papa''s Blue Spruce Resort - Events',
  'https://www.papasbluespruce.com/event-calendar',
  'scrape',
  'nightlife',
  'active',
  120,
  '{"expected_verticals": ["nightlife"], "location_tags": ["Lake Como", "Lake Geneva"], "use_firecrawl": true}'::jsonb
);

-- Add Fat Cat's Lake Geneva
INSERT INTO sources (name, url, type, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Fat Cat''s Lake Geneva',
  'https://www.fatcatslounge.com/',
  'scrape',
  'nightlife',
  'active',
  120,
  '{"expected_verticals": ["nightlife"], "location_tags": ["Lake Geneva"]}'::jsonb
);
