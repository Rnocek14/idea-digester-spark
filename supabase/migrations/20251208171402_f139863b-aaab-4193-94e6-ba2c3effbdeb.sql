-- Add Wisconsin 511 Traffic source
INSERT INTO sources (name, url, type, status, category, metadata)
VALUES (
  'Wisconsin 511 Traffic',
  'https://511wi.gov/api/v2',
  'api',
  'active',
  'news',
  '{"description": "Wisconsin DOT traffic incidents, road closures, and construction for Walworth County area", "location_tags": ["Lake Geneva", "Walworth County"], "incident_source": true}'::jsonb
)
ON CONFLICT DO NOTHING;