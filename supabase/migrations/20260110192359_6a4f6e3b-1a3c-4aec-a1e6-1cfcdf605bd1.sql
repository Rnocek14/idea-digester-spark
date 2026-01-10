-- Cleanup: Delete junk articles that slipped through
DELETE FROM content_queue 
WHERE id IN (
  '4ef6fa04-2a0e-4bd7-b38d-c97b18ae83d3',  -- Posts Categories
  '4d0f2d0c-fe5d-4fec-8697-0d97117ad66a',  -- Posts Categories
  '34e5eabd-a5ae-441a-a5da-2e68c55f0c22'   -- About
);

-- Also delete any other junk that matches patterns
DELETE FROM content_queue 
WHERE original_url LIKE '%/category/%'
   OR original_url LIKE '%/tag/%'
   OR original_url LIKE '%index.cfm%'
   OR title IN ('Home', 'About', 'Contact', 'Menu', 'Posts Categories', 'Uncategorized');