-- Add 'firecrawl' to allowed source types
ALTER TABLE public.sources DROP CONSTRAINT sources_type_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_type_check 
  CHECK (type = ANY (ARRAY['rss'::text, 'api'::text, 'scrape'::text, 'firecrawl'::text]));

-- Add restaurant website sources for Firecrawl scraping
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES 
  ('Pier 290', 'firecrawl', 'https://pier290.com/', 'restaurant', 'active', 
   '{"extract_fields": ["hours", "menu", "specials", "fish_fry", "happy_hour"]}'::jsonb, 10080),
  ('Sopra Bistro', 'firecrawl', 'https://www.soprabistro.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Popeyes Lake Geneva', 'firecrawl', 'https://www.popeyeslakegeneva.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "fish_fry"]}'::jsonb, 10080),
  ('Egg Harbor Cafe', 'firecrawl', 'https://www.eggharborcafe.com/locations/lake-geneva/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu"]}'::jsonb, 10080),
  ('Baker House', 'firecrawl', 'https://www.bakerhousewi.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Oakfire Pizza', 'firecrawl', 'https://www.oakfirelakegeneva.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Flat Iron Tap', 'firecrawl', 'https://flatironpub.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "happy_hour", "specials"]}'::jsonb, 10080),
  ('Hogs and Kisses', 'firecrawl', 'https://www.hogsandkisses.net/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Mars Resort', 'firecrawl', 'https://www.themarsresort.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "fish_fry", "specials"]}'::jsonb, 10080),
  ('Grand Geneva Dining', 'firecrawl', 'https://www.grandgeneva.com/dining/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Abbey Resort Dining', 'firecrawl', 'https://www.theabbeyresort.com/dining/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "specials"]}'::jsonb, 10080),
  ('Simple Cafe', 'firecrawl', 'https://www.simplelakeliving.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu"]}'::jsonb, 10080),
  ('Champs Sports Bar', 'firecrawl', 'https://www.champslakegeneva.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "fish_fry", "happy_hour"]}'::jsonb, 10080),
  ('Sprechers Restaurant', 'firecrawl', 'https://sprechersrestaurant.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "fish_fry", "specials"]}'::jsonb, 10080),
  ('Next Door Pub', 'firecrawl', 'https://www.nextdoorpub.com/', 'restaurant', 'active',
   '{"extract_fields": ["hours", "menu", "fish_fry", "happy_hour"]}'::jsonb, 10080)
ON CONFLICT DO NOTHING;