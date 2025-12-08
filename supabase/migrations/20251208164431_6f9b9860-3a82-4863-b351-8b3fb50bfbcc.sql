-- Disable City of Lake Geneva sources that are blocked by bot protection
-- These use CivicPlus platform which blocks server-side requests

UPDATE sources 
SET status = 'inactive', 
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb), 
      '{disabled_reason}', 
      '"CivicPlus platform blocks server-side requests with 403 Forbidden"'::jsonb
    )
WHERE name IN (
  'City of Lake Geneva – Civic Alerts',
  'City of Lake Geneva News RSS', 
  'Lake Geneva City Calendar'
);

-- Also disable broken venue sources with DNS failures
UPDATE sources 
SET status = 'inactive',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb), 
      '{disabled_reason}', 
      '"Domain DNS resolution failure"'::jsonb
    )
WHERE name IN (
  'Mars Resort - Events',
  'Hogs & Kisses - Events'
);

-- Disable Grand Geneva Nightlife which returns 404
UPDATE sources 
SET status = 'inactive',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb), 
      '{disabled_reason}', 
      '"Page returns 404 Not Found"'::jsonb
    )
WHERE name = 'Grand Geneva - Nightlife';