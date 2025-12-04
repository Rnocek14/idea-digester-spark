-- Add tagline to Gina Nocek's metadata
UPDATE business_profiles 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{tagline}',
  '"Realtor · @properties"'
)
WHERE name = 'Gina Nocek';