-- Add new venue sources for live music
INSERT INTO sources (name, url, type, category, status, default_geo_tier, metadata) VALUES
('PIER 290 - Events', 'https://pier290.com/', 'scrape', 'events', 'active', 1, 
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife", "eats"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article"}'::jsonb),
('Geneva Tap House - Events', 'https://genevataphouse.com/events/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife", "eats"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article"}'::jsonb),
('Lake Lawn Resort - Events', 'https://www.lakelawnresort.com/events/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Lake Geneva", "Delavan"], "verticals": ["nightlife"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article"}'::jsonb)
ON CONFLICT DO NOTHING;