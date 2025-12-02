-- Delete old civic meeting roundup posts
DELETE FROM post_queue 
WHERE post_text ILIKE '%THIS WEEKEND IN LAKE GENEVA%'
  AND (post_text ILIKE '%Municipal Court%' 
    OR post_text ILIKE '%Committee Meeting%' 
    OR post_text ILIKE '%Commission Meeting%'
    OR post_text ILIKE '%Council Meeting%'
    OR post_text ILIKE '%Board Meeting%');