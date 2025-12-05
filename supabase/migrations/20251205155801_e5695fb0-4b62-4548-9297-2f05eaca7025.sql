-- Add TMJ4 Walworth County (regional TV news)
INSERT INTO sources (name, url, type, category, status, metadata)
VALUES (
  'TMJ4 Walworth County',
  'https://www.tmj4.com/news/walworth-county',
  'scrape',
  'news',
  'active',
  jsonb_build_object(
    'scrape_selector', 'article, .ContentList a, .Card',
    'title_selector', 'h2, h3, .Card-title',
    'link_selector', 'a',
    'max_items_per_sync', 20
  )
)
ON CONFLICT DO NOTHING;

-- Add Fox6 Walworth County
INSERT INTO sources (name, url, type, category, status, metadata)
VALUES (
  'Fox6 Walworth County',
  'https://www.fox6now.com/tag/us/wi/walworth-county',
  'scrape',
  'news',
  'active',
  jsonb_build_object(
    'scrape_selector', 'article, .story-card, .card',
    'title_selector', 'h2, h3, .headline',
    'link_selector', 'a',
    'max_items_per_sync', 15
  )
)
ON CONFLICT DO NOTHING;

-- Add Fox6 Lake Geneva specific
INSERT INTO sources (name, url, type, category, status, metadata)
VALUES (
  'Fox6 Lake Geneva',
  'https://www.fox6now.com/tag/us/wi/walworth-county/lake-geneva',
  'scrape',
  'news',
  'active',
  jsonb_build_object(
    'scrape_selector', 'article, .story-card, .card',
    'title_selector', 'h2, h3, .headline',
    'link_selector', 'a',
    'max_items_per_sync', 10
  )
)
ON CONFLICT DO NOTHING;

-- Add City of Lake Geneva official RSS (civic news)
INSERT INTO sources (name, url, type, category, status, metadata)
VALUES (
  'City of Lake Geneva News RSS',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=All-0',
  'rss',
  'civic',
  'active',
  jsonb_build_object('official_source', true)
)
ON CONFLICT DO NOTHING;