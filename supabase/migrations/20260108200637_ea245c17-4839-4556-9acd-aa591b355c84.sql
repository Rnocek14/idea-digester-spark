-- Phase 1: Reactivate 8 High-Value Inactive Sources
UPDATE sources SET status = 'active', updated_at = now()
WHERE name IN (
  'Walworth County Alert Center RSS',
  'Walworth County News Flash RSS', 
  'Walworth County Agenda Center RSS',
  'Lake Geneva City Calendar',
  'Walworth County Sheriff News',
  'Patch Lake Geneva',
  'Lake Geneva Regional News RSS',
  'Kenosha News Walworth RSS'
) AND status = 'inactive';

-- Phase 2: Add 8 New Hyperlocal Sources

-- Schools (2)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, metadata, default_geo_tier)
VALUES 
  ('Williams Bay Schools Announcements', 'scrape', 'https://www.williamsbayschools.org/about/announcements.cfm', 'schools', 'active', 120, '{"location_tags": ["Williams Bay"], "scrape_selector": ".announcement-item, .news-item, article", "vertical_hints": ["local", "civic", "family"]}'::jsonb, 1),
  ('Badger High School News', 'scrape', 'https://www.badger.k12.wi.us/news', 'schools', 'active', 120, '{"location_tags": ["Lake Geneva"], "scrape_selector": ".news-item, article, .post", "vertical_hints": ["local", "civic", "family"]}'::jsonb, 1)
ON CONFLICT (url) DO UPDATE SET status = 'active', updated_at = now();

-- Municipal (4)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, metadata, default_geo_tier)
VALUES 
  ('Fontana Village News', 'scrape', 'https://vi.fontana.wi.gov/category/news/', 'civic', 'active', 180, '{"location_tags": ["Fontana"], "scrape_selector": "article, .post, .entry", "vertical_hints": ["local", "civic"]}'::jsonb, 1),
  ('Fontana Village Alerts', 'scrape', 'https://vi.fontana.wi.gov/category/alerts/', 'civic', 'active', 60, '{"location_tags": ["Fontana"], "scrape_selector": "article, .post, .entry", "vertical_hints": ["local", "civic", "safety"], "is_alert_source": true}'::jsonb, 1),
  ('Town of Delavan News', 'scrape', 'https://townofdelavan.com/news-and-notices/', 'civic', 'active', 180, '{"location_tags": ["Delavan"], "scrape_selector": "article, .news-item, .post", "vertical_hints": ["local", "civic"]}'::jsonb, 2),
  ('Williams Bay Village News', 'scrape', 'https://www.williamsbay.org/category/news/', 'civic', 'active', 180, '{"location_tags": ["Williams Bay"], "scrape_selector": "article, .post, .entry", "vertical_hints": ["local", "civic"]}'::jsonb, 1)
ON CONFLICT (url) DO UPDATE SET status = 'active', updated_at = now();

-- Civic RSS (2)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, metadata, default_geo_tier)
VALUES 
  ('Lake Geneva Agenda Center RSS', 'rss', 'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=65&CID=All-0', 'civic', 'active', 240, '{"location_tags": ["Lake Geneva"], "vertical_hints": ["local", "civic"]}'::jsonb, 1),
  ('Lake Geneva News Flash RSS', 'rss', 'https://www.cityoflakegeneva.gov/CivicAlerts.aspx?Format=RSS', 'civic', 'active', 30, '{"location_tags": ["Lake Geneva"], "vertical_hints": ["local", "civic", "safety"], "is_alert_source": true}'::jsonb, 1)
ON CONFLICT (url) DO UPDATE SET status = 'active', updated_at = now();