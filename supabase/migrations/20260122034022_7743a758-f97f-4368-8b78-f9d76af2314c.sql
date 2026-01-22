-- Add more Lake Geneva venue calendar sources
INSERT INTO sources (name, url, status, type, default_geo_tier, metadata) VALUES
  ('Fat Cat''s Bar & Grill Events', 'https://www.fatcatslakegeneva.com/events', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}'),
  ('Mars Resort Entertainment', 'https://www.marsresort.com/entertainment', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}'),
  ('Gordy''s Boat House Events', 'https://gordysboats.com/events', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}'),
  ('Crafted Americana Events', 'https://craftedamericana.com/events', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}'),
  ('Sprecher''s Restaurant Events', 'https://sprechersrestaurant.com/entertainment', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}'),
  ('Oakfire Pizza Events', 'https://www.oakfirelakegeneva.com/events', 'active', 'scrape', 1, '{"venue": true, "scrape_method": "firecrawl"}')
ON CONFLICT (url) DO NOTHING;