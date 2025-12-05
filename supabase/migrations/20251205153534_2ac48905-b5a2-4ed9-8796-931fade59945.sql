-- Add more news/civic sources to balance content mix
-- Target: reduce events from 69% to ~30%, boost news/civic to ~40%

-- 1. Walworth County Sheriff - Police/public safety news
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Walworth County Sheriff News',
  'scrape',
  'https://www.co.walworth.wi.us/203/News',
  'news',
  'active',
  120,
  '{"location_tags": ["Lake Geneva", "Walworth County"], "scrape_selector": ".news-item, .item", "vertical_hints": ["local", "civic"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- 2. Lake Geneva Regional News (Patch) 
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Lake Geneva Patch',
  'rss',
  'https://patch.com/wisconsin/lakegeneva/rss',
  'news',
  'active',
  60,
  '{"location_tags": ["Lake Geneva"], "vertical_hints": ["local"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- 3. Kenosha News - Regional (with geo-filter)
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Kenosha News - Walworth',
  'rss',
  'https://www.kenoshanews.com/search/?f=rss&t=article&c=news/local&l=50&s=start_time&sd=desc',
  'news',
  'active',
  90,
  '{"location_tags": ["Lake Geneva", "Walworth County"], "regional": true, "coverage_keywords": ["lake geneva", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "geneva lake"], "vertical_hints": ["local"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- 4. Lake Geneva Regional News (Journal Times - regional)
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Journal Times SE Wisconsin',
  'rss', 
  'https://journaltimes.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc',
  'news',
  'active',
  90,
  '{"location_tags": ["Lake Geneva", "Walworth County"], "regional": true, "coverage_keywords": ["lake geneva", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "geneva lake", "burlington"], "vertical_hints": ["local"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- Verify new sources
SELECT name, type, category, status FROM sources WHERE status = 'active' ORDER BY category, name;