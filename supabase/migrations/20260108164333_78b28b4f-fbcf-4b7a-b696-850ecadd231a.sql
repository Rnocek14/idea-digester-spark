-- Update dining sources with better, more actionable targets

-- Deactivate static directory sources (not valuable - just listings)
UPDATE sources SET status = 'inactive' 
WHERE name IN ('Visit Lake Geneva - Dining', 'Geneva Lake West Chamber - Restaurants');

-- Refine Regional News search for actionable dining news
UPDATE sources 
SET url = 'https://www.lakegenevaregionalnews.com/search/?f=html&q=fish+fry+OR+opening+OR+closing+OR+new+restaurant+OR+happy+hour&t=article&l=25&s=start_time&sd=desc',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{filter_keywords}',
      '["fish fry", "opening", "closing", "new restaurant", "happy hour", "special", "menu", "chef"]'::jsonb
    )
WHERE name = 'Regional News - Food & Dining';

-- Add Patch RSS with dining filter (they cover openings/closings)
INSERT INTO sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Patch - Dining News',
  'rss',
  'https://patch.com/wisconsin/lakegeneva/rss',
  'dining',
  'active',
  '{
    "filter_keywords": ["restaurant", "opens", "closes", "opening", "closing", "fish fry", "brewery", "winery", "bar", "cafe"],
    "regional": true,
    "expected_verticals": ["eats", "news"]
  }'::jsonb,
  180
) ON CONFLICT (url) DO NOTHING;

-- Add TMJ4 Food & Drink section 
INSERT INTO sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'TMJ4 - Food & Drink',
  'rss',
  'https://www.tmj4.com/news/food-and-drink.rss',
  'dining',
  'active',
  '{
    "regional": true,
    "expected_verticals": ["eats", "news"],
    "geo_filter": "lake geneva OR walworth OR williams bay OR fontana OR elkhorn"
  }'::jsonb,
  120
) ON CONFLICT (url) DO NOTHING;