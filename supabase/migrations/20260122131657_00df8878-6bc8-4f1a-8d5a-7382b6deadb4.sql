-- Add new venue sources for event diversity

-- Harpoon Willie's - Live Music Schedule
INSERT INTO sources (name, url, type, status, metadata) VALUES (
  'Harpoon Willie''s Live Music',
  'https://harpoonwillies.com/live-music-schedule-harpoonwilli/',
  'scrape',
  'active',
  '{
    "venue": true,
    "scraper": "venue-calendar",
    "expected_verticals": ["nightlife"],
    "location_tags": ["Williams Bay"]
  }'::jsonb
);

-- The Getaway - Live Music
INSERT INTO sources (name, url, type, status, metadata) VALUES (
  'The Getaway Live Music',
  'https://thegetawayrestaurant.com/live-music-in-lake-geneva/',
  'scrape',
  'active',
  '{
    "venue": true,
    "scraper": "venue-calendar",
    "expected_verticals": ["nightlife"],
    "location_tags": ["Lake Geneva"]
  }'::jsonb
);

-- Update Lake Lawn Resort - Events to be a venue source
UPDATE sources 
SET metadata = jsonb_set(
  jsonb_set(COALESCE(metadata, '{}'::jsonb), '{venue}', 'true'::jsonb),
  '{scraper}', '"venue-calendar"'::jsonb
)
WHERE name = 'Lake Lawn Resort - Events';

-- Update Abbey Resort - Events to be a venue source  
UPDATE sources 
SET metadata = jsonb_set(
  jsonb_set(COALESCE(metadata, '{}'::jsonb), '{venue}', 'true'::jsonb),
  '{scraper}', '"venue-calendar"'::jsonb
)
WHERE name = 'Abbey Resort - Events';