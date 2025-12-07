-- Add more venue sources for live music
INSERT INTO sources (name, url, type, category, status, default_geo_tier, metadata) VALUES
('Grand Geneva - Nightlife', 'https://www.grandgeneva.com/nightlife/', 'scrape', 'events', 'active', 1, 
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article, .card"}'::jsonb),
('Abbey Resort - Events', 'https://www.theabbeyresort.com/events/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Fontana", "Lake Geneva"], "verticals": ["nightlife", "eats"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article, .card"}'::jsonb),
('Maxwell Mansion - Events', 'https://staymaxwell.com/events/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article, .card"}'::jsonb),
('Hogs & Kisses - Events', 'https://www.hogsandkisses.net/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife", "eats"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article"}'::jsonb),
('Mars Resort - Events', 'https://www.themarsresort.com/', 'scrape', 'events', 'active', 1,
 '{"location_tags": ["Lake Geneva"], "verticals": ["nightlife", "eats"], "default_nightlife": true, "scrape_selector": ".event, .events-item, article"}'::jsonb)
ON CONFLICT DO NOTHING;