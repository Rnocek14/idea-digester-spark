-- Add Geneva Lake West Chamber Events RSS source
INSERT INTO sources (name, url, type, category, status, default_geo_tier, fetch_frequency_minutes, metadata)
VALUES (
  'Geneva Lake West Chamber Events',
  'https://genevalakewest.com/events/feed/',
  'rss',
  'events',
  'active',
  1,
  360,
  '{"trusted_locality": true, "coverage_area": "Fontana, Williams Bay, Walworth", "auto_approve": true}'::jsonb
);

-- Add auto-publish rule for this trusted local source
INSERT INTO auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
SELECT id, 'events', 'auto_publish', true, false
FROM sources WHERE name = 'Geneva Lake West Chamber Events';