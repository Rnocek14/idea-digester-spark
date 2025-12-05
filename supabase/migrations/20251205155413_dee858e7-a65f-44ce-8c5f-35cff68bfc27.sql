-- Fix Patch metadata keys to match what the code expects
UPDATE sources SET 
  metadata = jsonb_build_object(
    'scrape_selector', 'article',
    'title_selector', 'h2 a, h3 a',
    'link_selector', 'a'
  )
WHERE name = 'Lake Geneva Patch';