-- Add Lake Geneva Fire Department RSS as an incident source
INSERT INTO sources (name, url, type, status, category, default_geo_tier, fetch_frequency_minutes, metadata)
VALUES (
  'Lake Geneva Fire Department',
  'https://lakegenevafire.org/feed/',
  'rss',
  'active',
  'local',
  1,
  30,
  '{
    "description": "Official Lake Geneva Fire Department news - fires, rescues, training",
    "trust_locality": true,
    "is_incident_source": true,
    "location_tags": ["Lake Geneva"],
    "vertical_hints": ["local", "civic", "emergency"]
  }'::jsonb
)
ON CONFLICT DO NOTHING;