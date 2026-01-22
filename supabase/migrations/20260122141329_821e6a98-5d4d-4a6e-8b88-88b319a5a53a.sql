
-- Add Walworth County Sheriff Press Releases as hyperlocal news source
INSERT INTO sources (name, type, url, status, metadata)
VALUES (
  'Walworth County Sheriff Press Releases',
  'scrape',
  'https://www.co.walworth.wi.us/404/Sheriff-Press-Releases',
  'active',
  '{
    "default_geo_tier": 1,
    "default_category": "news",
    "scraper": "civic",
    "trusted_source": true,
    "description": "Official Walworth County Sheriff press releases - arrests, incidents, public safety"
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- Add Lake Geneva Police Department if they have a news feed
INSERT INTO sources (name, type, url, status, metadata)
VALUES (
  'City of Lake Geneva Police',
  'scrape', 
  'https://www.cityoflakegeneva.com/police',
  'active',
  '{
    "default_geo_tier": 1,
    "default_category": "news",
    "scraper": "civic",
    "trusted_source": true,
    "description": "Lake Geneva Police Department news and announcements"
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;
