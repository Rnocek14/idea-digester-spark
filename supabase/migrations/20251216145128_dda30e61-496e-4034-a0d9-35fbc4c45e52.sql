
-- Disable non-working Walworth County CivicEngage RSS feeds (cloud IP blocked)
UPDATE sources
SET 
  status = 'inactive',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'disabled_reason', 'cloud_ip_blocked',
    'disabled_at', now()::text,
    'requires_n8n', true
  )
WHERE name IN (
  'Walworth County Alert Center (RSS)',
  'Walworth County News Flash (RSS)',
  'Walworth County Agenda Center (RSS)'
);
