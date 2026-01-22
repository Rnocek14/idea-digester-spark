
-- Add City of Lake Geneva official RSS feeds (reliable, hyperlocal, official)
-- These are direct government feeds that work without scraping

INSERT INTO sources (name, type, url, status, metadata)
VALUES 
  -- Police alerts (arrests, incidents, public safety)
  ('City of Lake Geneva Police Alerts', 'rss', 
   'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=police', 
   'active',
   '{"default_geo_tier": 1, "default_category": "news", "trusted_source": true, "description": "Official Lake Geneva Police Department alerts and news"}'::jsonb),
   
  -- Fire department alerts
  ('City of Lake Geneva Fire Alerts', 'rss',
   'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=fire',
   'active', 
   '{"default_geo_tier": 1, "default_category": "news", "trusted_source": true, "description": "Official Lake Geneva Fire Department alerts"}'::jsonb),
   
  -- News Flash (general city news)
  ('City of Lake Geneva News', 'rss',
   'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=10&CID=All-news-flash',
   'active',
   '{"default_geo_tier": 1, "default_category": "civic", "trusted_source": true, "description": "Official City of Lake Geneva news and announcements"}'::jsonb),
   
  -- Public Works alerts (road closures, construction)
  ('City of Lake Geneva Public Works', 'rss',
   'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=public-works',
   'active',
   '{"default_geo_tier": 1, "default_category": "civic", "trusted_source": true, "description": "Road closures, construction updates, public works announcements"}'::jsonb)
   
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- Also activate the existing City of Lake Geneva Civic source if not active
UPDATE sources 
SET status = 'active'
WHERE name = 'City of Lake Geneva Civic';
