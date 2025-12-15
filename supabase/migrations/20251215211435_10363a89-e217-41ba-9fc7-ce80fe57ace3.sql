-- Fix City of Lake Geneva URL to actual Alert Center RSS feed
UPDATE sources 
SET url = 'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=All-0'
WHERE name = 'City of Lake Geneva Civic';

-- Walworth County RSS doesn't exist - update to News/Press Releases page with scraper
UPDATE sources 
SET 
  type = 'scrape',
  url = 'https://www.co.walworth.wi.us/1214/News-Room',
  metadata = '{"location_tags": ["Walworth County"], "trusted_locality": true, "scrape_selector": ".news-item, .newsfeed-item, article", "vertical_hints": ["local", "civic"]}'::jsonb
WHERE name = 'Walworth County Government';