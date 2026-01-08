-- Dining & Restaurant Sources for Lake Geneva Eats Vertical
-- Run this in the Supabase SQL Editor to add dining content sources

-- Visit Lake Geneva Dining Directory (scrape)
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Visit Lake Geneva - Dining',
  'scrape',
  'https://www.visitlakegeneva.com/restaurants/',
  'dining',
  'active',
  '{
    "scrape_selector": ".listing-card, .restaurant-item, article",
    "title_selector": "h3, h2, .title a",
    "link_selector": "a.listing-link, h3 a, a",
    "desc_selector": ".description, p, .excerpt",
    "regional": false,
    "expected_verticals": ["eats", "dining"]
  }'::jsonb,
  1440
) ON CONFLICT DO NOTHING;

-- Lake Geneva Regional News - Food Section (RSS if available, else scrape)
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Regional News - Food & Dining',
  'scrape',
  'https://www.lakegenevaregionalnews.com/search/?f=html&q=restaurant+OR+dining+OR+food&t=article&l=25&s=start_time&sd=desc',
  'dining',
  'active',
  '{
    "scrape_selector": ".search-result, article",
    "title_selector": "h3 a, .headline a",
    "link_selector": "h3 a, .headline a",
    "desc_selector": ".excerpt, .summary",
    "regional": true,
    "expected_verticals": ["eats", "dining", "news"]
  }'::jsonb,
  720
) ON CONFLICT DO NOTHING;

-- Geneva Lake West Chamber - Dining Members
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Geneva Lake West Chamber - Restaurants',
  'scrape',
  'https://www.genevalakewest.com/list/category/restaurants-dining-nightlife-35',
  'dining',
  'active',
  '{
    "scrape_selector": ".mn-member, .card",
    "title_selector": "h4, .name, a",
    "link_selector": "a",
    "desc_selector": ".description, p",
    "regional": false,
    "expected_verticals": ["eats", "dining"]
  }'::jsonb,
  1440
) ON CONFLICT DO NOTHING;

-- Patch Lake Geneva - Food & Drink (filtered)
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Patch - Lake Geneva Food & Drink',
  'rss',
  'https://patch.com/wisconsin/lakegeneva/rss',
  'dining',
  'active',
  '{
    "filter_keywords": ["restaurant", "dining", "food", "bar", "brewery", "winery", "cafe", "bakery", "fish fry"],
    "regional": true,
    "expected_verticals": ["eats", "dining", "news"]
  }'::jsonb,
  120
) ON CONFLICT DO NOTHING;

-- Verify sources were added
SELECT 
  id,
  name,
  type,
  category,
  status,
  url,
  metadata->>'expected_verticals' as verticals
FROM sources 
WHERE category IN ('dining', 'restaurant', 'food')
ORDER BY name;
