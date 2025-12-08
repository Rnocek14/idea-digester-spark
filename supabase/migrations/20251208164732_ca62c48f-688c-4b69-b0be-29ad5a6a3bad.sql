-- Update TMJ4 Walworth County to use RSS feed instead of scrape
UPDATE sources 
SET url = 'https://www.tmj4.com/news/walworth-county.rss',
    type = 'rss',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{category}',
      '"news"'::jsonb
    )
WHERE id = 'c0a0fbf8-cb42-418b-813b-4d1cc573381a';

-- Insert TMJ4 Local News (Milwaukee regional) with geo-filtering for Lake Geneva area
INSERT INTO sources (name, url, type, status, category, metadata)
VALUES (
  'TMJ4 Local News (Regional)',
  'https://www.tmj4.com/news/local-news.rss',
  'rss',
  'active',
  'news',
  '{"regional": true, "coverage_keywords": ["lake geneva", "walworth county", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "highway 50", "hwy 50", "us-12", "geneva lake"], "default_geo_tier": 2}'::jsonb
)
ON CONFLICT DO NOTHING;