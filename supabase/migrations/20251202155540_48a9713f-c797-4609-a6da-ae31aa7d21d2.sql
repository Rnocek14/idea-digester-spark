-- Update Civic Alerts RSS with correct feed URL
UPDATE public.sources 
SET 
  url = 'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=All-0',
  status = 'active',
  updated_at = now()
WHERE id = '4bc9d4d1-0297-4b2b-bf46-2278e776fe4a';

-- Update City Calendar scrape with correct selector
UPDATE public.sources 
SET 
  metadata = jsonb_set(
    metadata,
    '{scrape_selector}',
    '".calendars .calendar li"'
  ),
  status = 'active',
  updated_at = now()
WHERE id = 'c55186ae-7464-4ded-983c-b32407eb95d5';