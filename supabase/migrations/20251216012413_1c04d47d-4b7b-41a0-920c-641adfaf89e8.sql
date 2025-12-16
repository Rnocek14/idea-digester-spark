
-- Add City of Lake Geneva Calendar source
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES 
  ('City of Lake Geneva Calendar', 'scrape', 'https://www.cityoflakegeneva.gov/Calendar.aspx?CID=14', 'civic', 'active', 180, 1, '{"trusted_locality": true, "scrape_type": "civicengage_calendar"}'::jsonb),
  ('Downtown Lake Geneva Events', 'scrape', 'https://www.downtownlakegeneva.org/event-list', 'events', 'active', 180, 1, '{"trusted_locality": true, "scrape_type": "html_list"}'::jsonb);

-- Disable library source since calendar is broken upstream
UPDATE sources SET status = 'inactive' WHERE name LIKE '%Library%Events%';
