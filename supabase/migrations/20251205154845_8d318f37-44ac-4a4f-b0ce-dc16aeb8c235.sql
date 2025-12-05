-- Convert Patch to scraper (RSS doesn't work)
UPDATE sources SET 
  type = 'scrape',
  url = 'https://patch.com/wisconsin/lake-geneva-wi',
  metadata = '{"selector": "article.styles_Card__wueGs", "title_selector": "h2", "link_selector": "a"}'::jsonb
WHERE name = 'Lake Geneva Patch';

-- Deactivate Lake Geneva Regional News temporarily (rate limited)
UPDATE sources SET status = 'inactive'
WHERE name = 'Lake Geneva Regional News';