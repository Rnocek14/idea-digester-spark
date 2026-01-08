-- Add 25+ Lake Geneva restaurant sources for bulk scraping
-- Category: restaurant, Type: diy-scrape (uses our DIY scraper)

-- Popular lakefront dining
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES 
  ('Baker House', 'diy-scrape', 'https://bakerhousewi.com/', 'restaurant', 'active', 
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Grand Geneva Dining', 'diy-scrape', 'https://www.grandgeneva.com/dining/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Abbey Resort Dining', 'diy-scrape', 'https://theabbeyresort.com/dining/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Egg Harbor Cafe Lake Geneva', 'diy-scrape', 'https://www.eggharborcafe.com/locations/lake-geneva/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Popeyes Lake Geneva', 'diy-scrape', 'https://www.popeyeslakegeneva.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Riva Lake Geneva', 'diy-scrape', 'https://rivalakegeneva.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Geneva ChopHouse', 'diy-scrape', 'https://www.genevachophouse.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Barrique Bistro & Wine Bar', 'diy-scrape', 'https://www.barriquebistro.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Simple Cafe', 'diy-scrape', 'https://www.simplelakeliving.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Sprechers Restaurant', 'diy-scrape', 'https://www.sprechersrestaurant.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Flat Iron Tap', 'diy-scrape', 'https://www.flatironpub.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Medusa Grill & Bistro', 'diy-scrape', 'https://www.medusagrill.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Hogs and Kisses', 'diy-scrape', 'https://hogsandkisses.net/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Mars Resort', 'diy-scrape', 'https://themarsresort.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Chucks Lakeshore Inn', 'diy-scrape', 'https://chuckslakeshoreinn.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Tuscan Tavern & Grill', 'diy-scrape', 'https://www.tuscantavernlakegeneva.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Hunt Club Steakhouse', 'diy-scrape', 'https://www.huntclubsteakhouse.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Lake Geneva Pie Company', 'diy-scrape', 'https://lakegenevapie.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Gordys Boathouse', 'diy-scrape', 'https://www.gordysboats.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Geneva National Resort Dining', 'diy-scrape', 'https://www.genevanationalresort.com/dining/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Cafe Calamari', 'diy-scrape', 'https://www.cafecalamari.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Next Door Pub', 'diy-scrape', 'https://nextdoorpub.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Ginos East Lake Geneva', 'diy-scrape', 'https://www.ginoseast.com/lake-geneva/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('Oakfire', 'diy-scrape', 'https://www.oakfirewi.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080),
   
  ('531 Lake Geneva', 'diy-scrape', 'https://www.531lakegeneva.com/', 'restaurant', 'active',
   '{"expected_verticals": ["eats"], "scraper_type": "diy"}'::jsonb, 10080)
ON CONFLICT (url) DO UPDATE SET
  type = 'diy-scrape',
  status = 'active',
  category = 'restaurant',
  metadata = EXCLUDED.metadata;

-- Update existing error sources to use DIY scraper
UPDATE public.sources 
SET type = 'diy-scrape', 
    status = 'active',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"scraper_type": "diy", "migrated_from": "firecrawl"}'::jsonb
WHERE category = 'restaurant' 
  AND status = 'error'
  AND type = 'firecrawl';

-- Also update any firecrawl restaurant sources to diy-scrape
UPDATE public.sources 
SET type = 'diy-scrape',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"scraper_type": "diy", "migrated_from": "firecrawl"}'::jsonb
WHERE category = 'restaurant' 
  AND type = 'firecrawl';