-- Fix Lake Geneva Patch URL (correct format is lake-geneva-wi, not lake-geneva)
UPDATE sources SET 
  url = 'https://patch.com/wisconsin/lake-geneva-wi/rss'
WHERE name = 'Lake Geneva Patch';

-- Add Lake Geneva Regional News (lakegenevanews.net) - the actual local paper!
INSERT INTO sources (name, type, url, category, status, metadata) 
VALUES (
  'Lake Geneva Regional News',
  'rss',
  'https://lakegenevanews.net/search/?f=rss&t=article&l=50&s=start_time&sd=desc',
  'news',
  'active',
  '{"priority_boost": 1.2, "is_local_paper": true}'::jsonb
)
ON CONFLICT DO NOTHING;