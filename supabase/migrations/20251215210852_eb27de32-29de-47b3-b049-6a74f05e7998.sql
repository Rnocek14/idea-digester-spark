-- Add missing auto-publish rule for Lake Geneva Public Library Events
INSERT INTO auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
SELECT id, 'events', 'auto_publish', true, false
FROM sources 
WHERE name = 'Lake Geneva Public Library Events'
ON CONFLICT DO NOTHING;