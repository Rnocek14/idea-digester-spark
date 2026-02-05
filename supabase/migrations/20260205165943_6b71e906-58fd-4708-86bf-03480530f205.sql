
-- Add high-value hyperlocal safety and civic sources
-- Lake Geneva sources are direct RSS, County sources marked inactive until n8n setup

-- Lake Geneva Police Alerts (CivicEngage RSS)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Police Alerts',
  'rss',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=Police-4',
  'safety',
  'active',
  30,
  1,
  '{"location_tags": ["Lake Geneva"], "auto_publish": true, "priority": "high"}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Lake Geneva Fire Alerts (CivicEngage RSS)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Fire Alerts',
  'rss',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=Fire-5',
  'safety',
  'active',
  30,
  1,
  '{"location_tags": ["Lake Geneva"], "auto_publish": true, "priority": "high"}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Lake Geneva City Alerts (All alerts - civic)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva City Alerts',
  'rss',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=All-0',
  'civic',
  'active',
  60,
  1,
  '{"location_tags": ["Lake Geneva"], "auto_publish": true}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Lake Geneva Meeting Agendas
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Meeting Agendas',
  'rss',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=65&CID=All-0',
  'civic',
  'active',
  120,
  1,
  '{"location_tags": ["Lake Geneva"], "content_type": "agenda"}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Lake Geneva News Flash (official city news)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva News Flash',
  'rss',
  'https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=1&CID=All-0',
  'civic',
  'active',
  60,
  1,
  '{"location_tags": ["Lake Geneva"], "auto_publish": true}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Walworth County Sheriff News (inactive until n8n webhook configured)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Sheriff Press Releases',
  'scrape',
  'https://www.co.walworth.wi.us/747/News-Releases',
  'safety',
  'inactive',
  60,
  2,
  '{"location_tags": ["Walworth County"], "auto_publish": true, "priority": "high", "ingestion_method": "n8n_webhook", "setup_required": true, "note": "CivicEngage bot-protected - requires n8n fetch"}'::jsonb
) ON CONFLICT (url) DO NOTHING;

-- Walworth County Newsroom (inactive until n8n webhook configured)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Newsroom',
  'scrape',
  'https://www.co.walworth.wi.us/civicalerts.aspx',
  'civic',
  'inactive',
  60,
  2,
  '{"location_tags": ["Walworth County"], "auto_publish": true, "ingestion_method": "n8n_webhook", "setup_required": true, "note": "CivicEngage bot-protected - requires n8n fetch"}'::jsonb
) ON CONFLICT (url) DO NOTHING;
