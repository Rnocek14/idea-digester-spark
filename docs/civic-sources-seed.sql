-- Civic Content Sources for Lake Geneva
-- Run this in Supabase SQL Editor to add civic/community/school sources
-- These sources diversify content away from 77% events toward true newsroom coverage

-- 1. Lake Geneva School District News
-- Covers: enrollment, school board, programs, student achievements, district announcements
-- Expected verticals: ["local", "civic", "family"]
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
-- Covers: library programs, community events, kids/family activities, educational workshops
-- Expected verticals: ["local", "family", "community"]
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
-- Covers: city council meetings, board meetings, public hearings, municipal announcements
-- Expected verticals: ["local", "civic"]
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

-- Verify sources were created
SELECT 
  id,
  name,
  type,
  category,
  status,
  url,
  metadata->>'vertical_hints' as expected_verticals
FROM sources
WHERE name IN (
  'Lake Geneva School District News',
  'Lake Geneva Public Library Events',
  'Lake Geneva City Calendar'
)
ORDER BY created_at DESC;
