-- Fix Lake Geneva School District News extraction selectors
UPDATE sources 
SET metadata = jsonb_set(
  jsonb_set(
    metadata, 
    '{title_selector}', 
    '".fsTitle a, .fsPostTitle a"'
  ),
  '{link_selector}',
  '".fsTitle a, .fsPostTitle a"'
)
WHERE name = 'Lake Geneva School District News';

-- Temporarily disable broken scrapers until correct selectors are researched
UPDATE sources
SET status = 'inactive'
WHERE name IN ('Lake Geneva Public Library Events', 'Lake Geneva City Calendar');