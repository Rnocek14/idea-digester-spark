
-- Clean up duplicate source URLs (keep one per URL, prefer active)

-- Delete duplicate City of Lake Geneva sources (keep active: 549991d5-09a5-4fdd-baf3-13b657a09ada)
DELETE FROM sources WHERE id IN (
  '4bc9d4d1-0297-4b2b-bf46-2278e776fe4a',
  'bade83c9-4d52-4017-90b1-3befc8b86ebb'
);

-- Delete duplicate Patch sources (keep newer: 3e77fc52-e069-4d2a-af8c-b981c5f046bf)
DELETE FROM sources WHERE id = 'f21761c9-f395-4398-bcef-c97866781c91';

-- Delete duplicate Walworth County Community News (keep active: c3a69b36-0069-409a-9021-f31798b51389)
DELETE FROM sources WHERE id = 'b36bbc11-b579-4b69-bd23-751612c6c1d7';

-- Now create unique index on URL
CREATE UNIQUE INDEX IF NOT EXISTS uq_sources_url ON sources (url);

-- Insert Walworth County Alert Center
INSERT INTO sources (name, url, type, category, status, default_geo_tier, fetch_frequency_minutes, metadata)
VALUES (
  'Walworth County Alert Center (RSS)',
  'https://www.co.walworth.wi.us/CivicAlerts.aspx?Format=RSS',
  'rss',
  'civic',
  'active',
  2,
  60,
  '{"trusted_locality": true, "description": "County-wide alerts (scams, notices, disruptions)", "source_kind": "civicengage_alerts"}'::jsonb
);

-- Insert Walworth County News Flash
INSERT INTO sources (name, url, type, category, status, default_geo_tier, fetch_frequency_minutes, metadata)
VALUES (
  'Walworth County News Flash (RSS)',
  'https://www.co.walworth.wi.us/CivicAlerts.aspx?CID=14,3,1,8&Format=RSS',
  'rss',
  'civic',
  'active',
  2,
  120,
  '{"trusted_locality": true, "description": "County government news & updates (News Flash)", "source_kind": "civicengage_newsflash"}'::jsonb
);

-- Insert Walworth County Agenda Center
INSERT INTO sources (name, url, type, category, status, default_geo_tier, fetch_frequency_minutes, metadata)
VALUES (
  'Walworth County Agenda Center (RSS)',
  'https://www.co.walworth.wi.us/AgendaCenter/Feed',
  'rss',
  'civic',
  'active',
  2,
  180,
  '{"trusted_locality": true, "description": "Board & committee agenda updates", "source_kind": "civicengage_agendas"}'::jsonb
);
