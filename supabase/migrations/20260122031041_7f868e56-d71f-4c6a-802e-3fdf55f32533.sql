-- Add Lake Geneva venue calendar sources
INSERT INTO sources (name, url, type, category, status, default_geo_tier, metadata)
VALUES 
  ('Lake Geneva House of Music', 'https://www.lghom.com/live-entertainment', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('The Bottle Shop Events', 'https://thebottleshoplakegeneva.com/calendar/', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('Studio Winery Live Music', 'https://www.studiowinery.com/music/live-music', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('Duesterbeck''s Brewing Events', 'https://www.dbcbrewery.com/events', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('Magpie''s Den & Pen Events', 'https://magpieslg.com/lake-geneva-magpies-den-and-pen-events', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('Grand Geneva Entertainment', 'https://www.grandgeneva.com/activities/live-entertainment', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb),
  ('Pier 290 Calendar', 'https://pier290.com/events-calendar/', 'scrape', 'nightlife', 'active', 1, '{"venue": true, "scraper": "venue-calendar"}'::jsonb)
ON CONFLICT (url) DO UPDATE SET 
  metadata = EXCLUDED.metadata,
  status = 'active';