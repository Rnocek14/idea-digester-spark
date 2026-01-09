-- Dining & Restaurant Sources for Lake Geneva Eats Vertical
-- Run this in the Supabase SQL Editor to add/fix dining content sources
-- Updated: Includes news sources for openings, closings, reviews

-- ============================================
-- DINING NEWS SOURCES (openings, closings, reviews)
-- ============================================

-- Patch Lake Geneva - Food & Drink (filtered RSS)
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Patch - Lake Geneva Food & Drink',
  'rss',
  'https://patch.com/wisconsin/lakegeneva/rss',
  'dining',
  'active',
  '{
    "filter_keywords": ["restaurant", "dining", "food", "bar", "brewery", "winery", "cafe", "bakery", "fish fry", "opens", "opening", "closing", "new menu", "chef"],
    "regional": true,
    "trust_locality": true,
    "expected_verticals": ["eats", "dining", "news"],
    "dining_news": true
  }'::jsonb,
  120
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata,
  category = 'dining';

-- Lake Geneva Regional News - Food Section
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Regional News - Food & Dining',
  'scrape',
  'https://www.lakegenevaregionalnews.com/search/?f=html&q=restaurant+OR+dining+OR+food+OR+opens+OR+closing&t=article&l=25&s=start_time&sd=desc',
  'dining',
  'active',
  '{
    "scrape_selector": ".search-result, article, .card",
    "title_selector": "h3 a, .headline a, h2 a",
    "link_selector": "h3 a, .headline a",
    "desc_selector": ".excerpt, .summary, p",
    "regional": true,
    "expected_verticals": ["eats", "dining", "news"],
    "dining_news": true
  }'::jsonb,
  720
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- TMJ4 Wisconsin - Food & Drink (filtered)
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'TMJ4 - Food & Drink',
  'rss',
  'https://www.tmj4.com/food/rss.xml',
  'dining',
  'active',
  '{
    "filter_keywords": ["lake geneva", "walworth", "delavan", "elkhorn", "fontana", "williams bay"],
    "regional": true,
    "expected_verticals": ["eats", "dining", "news"],
    "dining_news": true
  }'::jsonb,
  240
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- ============================================
-- RESTAURANT DIRECTORY SOURCES
-- ============================================

-- Visit Lake Geneva Dining Directory
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Visit Lake Geneva - Dining',
  'scrape',
  'https://www.visitlakegeneva.com/restaurants/',
  'dining',
  'active',
  '{
    "scrape_selector": ".listing-card, .business-card, article, .result-item",
    "title_selector": "h3, h2, .title a, .name",
    "link_selector": "a.listing-link, h3 a, a[href*=restaurant]",
    "desc_selector": ".description, p, .excerpt, .summary",
    "regional": false,
    "expected_verticals": ["eats", "dining"],
    "scraper_type": "directory"
  }'::jsonb,
  1440
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- Geneva Lake West Chamber - Restaurants
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Geneva Lake West Chamber - Restaurants',
  'scrape',
  'https://www.genevalakewest.com/list/category/restaurants-dining-nightlife-35',
  'dining',
  'active',
  '{
    "scrape_selector": ".mn-member, .card, .directory-item, article",
    "title_selector": "h4, .name, a, h3",
    "link_selector": "a[href*=member], a.card-link, a",
    "desc_selector": ".description, p, .excerpt",
    "regional": false,
    "expected_verticals": ["eats", "dining"],
    "scraper_type": "directory"
  }'::jsonb,
  1440
)
ON CONFLICT (url) DO UPDATE SET 
  status = 'active',
  metadata = EXCLUDED.metadata;

-- ============================================
-- VERIFY DINING SOURCES
-- ============================================
SELECT 
  id,
  name,
  type,
  category,
  status,
  metadata->>'dining_news' as is_dining_news,
  metadata->>'expected_verticals' as verticals,
  last_fetched_at
FROM sources 
WHERE category IN ('dining', 'restaurant', 'food')
   OR name ILIKE '%dining%'
   OR name ILIKE '%food%'
   OR name ILIKE '%restaurant%'
ORDER BY status, name;
