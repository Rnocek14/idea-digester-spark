-- Add Civic Content Sources for Lake Geneva
-- These sources diversify content away from 77% events toward true newsroom coverage

-- 1. Lake Geneva School District News
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Lake Geneva School District News',
  'scrape',
  'https://www.lakegenevaschools.com/news',
  'schools',
  'active',
  120,
  '{"location_tags": ["Lake Geneva"], "scrape_selector": "article.fsBoard-3", "vertical_hints": ["local", "civic", "family"]}'::jsonb
);

-- 2. Lake Geneva Public Library Events  
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Lake Geneva Public Library Events',
  'scrape',
  'https://lglibrary.org/eventcal',
  'community',
  'active',
  180,
  '{"location_tags": ["Lake Geneva"], "scrape_selector": ".eventlist-event", "vertical_hints": ["local", "family"]}'::jsonb
);

-- 3. Lake Geneva City Calendar
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES (
  'Lake Geneva City Calendar',
  'scrape',
  'https://www.cityoflakegeneva.gov/Calendar.aspx',
  'civic',
  'active',
  240,
  '{"location_tags": ["Lake Geneva"], "scrape_selector": ".calendarCell", "vertical_hints": ["local", "civic"]}'::jsonb
);