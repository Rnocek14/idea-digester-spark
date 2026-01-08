-- Add dining content sources for automatic sync
-- Visit Lake Geneva Dining Directory
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Visit Lake Geneva - Dining',
  'scrape',
  'https://www.visitlakegeneva.com/restaurants/',
  'dining',
  'active',
  '{
    "scrape_selector": ".listing-card, .restaurant-item, article",
    "title_selector": "h3, h2, .title a",
    "link_selector": "a.listing-link, h3 a, a",
    "desc_selector": ".description, p, .excerpt",
    "regional": false,
    "expected_verticals": ["eats", "dining"]
  }'::jsonb,
  1440
) ON CONFLICT (url) DO UPDATE SET
  status = 'active',
  category = 'dining',
  metadata = EXCLUDED.metadata;

-- Lake Geneva Regional News - Food searches
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Regional News - Food & Dining',
  'scrape',
  'https://www.lakegenevaregionalnews.com/search/?f=html&q=restaurant+OR+dining&t=article&l=25&s=start_time&sd=desc',
  'dining',
  'active',
  '{
    "scrape_selector": ".search-result, article",
    "title_selector": "h3 a, .headline a",
    "link_selector": "h3 a, .headline a",
    "desc_selector": ".excerpt, .summary",
    "regional": true,
    "expected_verticals": ["eats", "dining", "news"]
  }'::jsonb,
  720
) ON CONFLICT (url) DO UPDATE SET
  status = 'active',
  category = 'dining',
  metadata = EXCLUDED.metadata;

-- Geneva Lake West Chamber - Restaurants
INSERT INTO public.sources (name, type, url, category, status, metadata, fetch_frequency_minutes)
VALUES (
  'Geneva Lake West Chamber - Restaurants',
  'scrape',
  'https://www.genevalakewest.com/list/category/restaurants-dining-nightlife-35',
  'dining',
  'active',
  '{
    "scrape_selector": ".mn-member, .card",
    "title_selector": "h4, .name, a",
    "link_selector": "a",
    "desc_selector": ".description, p",
    "regional": false,
    "expected_verticals": ["eats", "dining"]
  }'::jsonb,
  1440
) ON CONFLICT (url) DO UPDATE SET
  status = 'active',
  category = 'dining',
  metadata = EXCLUDED.metadata;

-- Schedule sync-dining-content to run twice daily (6 AM and 6 PM Central = 12:00 and 00:00 UTC)
SELECT cron.schedule(
  'sync-dining-content-morning',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-dining-content',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'sync-dining-content-evening',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-dining-content',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);