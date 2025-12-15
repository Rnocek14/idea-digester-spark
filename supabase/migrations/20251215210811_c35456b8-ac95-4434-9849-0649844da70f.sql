-- Add top 3 hyperlocal backbone sources

-- 1. City of Lake Geneva Civic RSS (agendas, notices, road work)
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'City of Lake Geneva Civic',
  'rss',
  'https://www.cityoflakegeneva.gov/rss.aspx',
  'civic',
  'active',
  120,
  1,
  '{"location_tags": ["Lake Geneva"], "trusted_locality": true, "vertical_hints": ["local", "civic"]}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 2. Walworth County Government News
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Government',
  'rss',
  'https://www.co.walworth.wi.us/rss.xml',
  'civic',
  'active',
  180,
  2,
  '{"location_tags": ["Walworth County"], "trusted_locality": true, "vertical_hints": ["local", "civic"]}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 3. Lake Geneva Public Library Events
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Public Library Events',
  'scrape',
  'https://lglibrary.org/eventcal',
  'events',
  'active',
  240,
  1,
  '{"location_tags": ["Lake Geneva"], "trusted_locality": true, "scrape_selector": ".eventlist-event", "vertical_hints": ["local", "family", "community"]}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Add auto-publish rules for these inherently local sources (they don't need hyperlocal gate)
-- Get source IDs and create rules
DO $$
DECLARE
  city_lg_id uuid;
  walworth_id uuid;
  library_id uuid;
BEGIN
  SELECT id INTO city_lg_id FROM sources WHERE name = 'City of Lake Geneva Civic' LIMIT 1;
  SELECT id INTO walworth_id FROM sources WHERE name = 'Walworth County Government' LIMIT 1;
  SELECT id INTO library_id FROM sources WHERE name = 'Lake Geneva Public Library Events' LIMIT 1;

  -- City of Lake Geneva civic auto-publish (inherently local, no hyperlocal gate needed)
  IF city_lg_id IS NOT NULL THEN
    INSERT INTO auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
    VALUES (city_lg_id, 'civic', 'auto_publish', true, false)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Walworth County civic auto-publish
  IF walworth_id IS NOT NULL THEN
    INSERT INTO auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
    VALUES (walworth_id, 'civic', 'auto_publish', true, false)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Library events auto-publish
  IF library_id IS NOT NULL THEN
    INSERT INTO auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
    VALUES (library_id, 'events', 'auto_publish', true, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;