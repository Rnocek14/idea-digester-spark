-- Add Zillow review columns to business_profiles
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS zillow_url text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS zillow_rating numeric;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS zillow_review_count integer;

-- Update Gina Nocek's record with Zillow data
UPDATE business_profiles 
SET 
  zillow_url = 'https://www.zillow.com/profile/Gina-Nocek',
  zillow_rating = 5.0,
  zillow_review_count = 72
WHERE name ILIKE '%gina nocek%' OR name ILIKE '%nocek%';