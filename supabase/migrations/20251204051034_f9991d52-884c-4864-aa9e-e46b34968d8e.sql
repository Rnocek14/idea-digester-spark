-- Add testimonial_quote column to business_profiles
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS testimonial_quote text;

-- Update Gina's record with her testimonial
UPDATE business_profiles 
SET testimonial_quote = 'Gina handled everything for us from Chicago — we closed above asking in 10 days.'
WHERE id = 'db06b0ce-2fe3-4a01-a870-7f2aef1913a6';