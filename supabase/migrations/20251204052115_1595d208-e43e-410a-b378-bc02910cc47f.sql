-- Add business_id column to link leads to specific sponsors
ALTER TABLE advertiser_leads ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES business_profiles(id);