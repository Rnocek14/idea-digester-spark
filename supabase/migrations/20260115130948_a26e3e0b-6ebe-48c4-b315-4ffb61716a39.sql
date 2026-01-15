-- Add direct venue event sources for nightlife/music
INSERT INTO sources (name, url, type, category, status, metadata, default_geo_tier) VALUES
('House of Music - Events', 'https://www.lghom.com/live-entertainment', 'scrape', 'nightlife', 'active', '{"venue": "House of Music", "scrape_for": "live music events"}', 0),
('Topsy Turvy Brewery - Events', 'https://www.topsyturvybrewery.com/events', 'scrape', 'nightlife', 'active', '{"venue": "Topsy Turvy Brewery", "scrape_for": "live music events"}', 0),
('Gordys Boat House - Events', 'https://www.gordysboats.com/events-calendar-boats-dealership--xlistevents', 'scrape', 'nightlife', 'active', '{"venue": "Gordys Boat House", "scrape_for": "live music events"}', 0),
('Crafted Americana - Events', 'https://www.craftedlakegeneva.com/specials', 'scrape', 'nightlife', 'active', '{"venue": "Crafted Americana", "scrape_for": "specials and events"}', 0),
('DJs in the Drink', 'https://djsinthedrink.com/', 'scrape', 'nightlife', 'active', '{"venue": "DJs in the Drink", "scrape_for": "live music events"}', 0),
('Thumbs Up Pub', 'http://thumbsuplakegeneva.com/', 'scrape', 'nightlife', 'active', '{"venue": "Thumbs Up Pub", "scrape_for": "live music events"}', 0),
('Lake City Social', 'https://lakecitysocialwi.com/', 'scrape', 'nightlife', 'active', '{"venue": "Lake City Social", "scrape_for": "live music events"}', 0),
('Hogs and Kisses Saloon', 'https://www.hogsandkissessaloon.com/', 'scrape', 'nightlife', 'active', '{"venue": "Hogs and Kisses", "scrape_for": "live music events"}', 0)
ON CONFLICT DO NOTHING;

-- Update existing bar sources to also track nightlife
UPDATE sources 
SET category = 'nightlife',
    metadata = jsonb_set(COALESCE(metadata, '{}')::jsonb, '{also_restaurant}', 'true')
WHERE name IN ('Chucks Lakeshore Inn', 'Gordys Boathouse', 'Harpoon Willies')
  AND category = 'restaurant';

-- Add auto-publish rule for nightlife category
INSERT INTO auto_publish_rules (category, action, enabled, requires_hyperlocal)
VALUES ('nightlife', 'auto_publish', true, false)
ON CONFLICT DO NOTHING;