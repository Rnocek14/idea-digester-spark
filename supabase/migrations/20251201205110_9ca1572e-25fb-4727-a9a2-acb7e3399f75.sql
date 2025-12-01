-- Add sponsor tracking fields to newsletter_clicks table
ALTER TABLE newsletter_clicks
ADD COLUMN business_id uuid REFERENCES business_profiles(id),
ADD COLUMN ad_placement_id uuid REFERENCES ad_placements(id),
ADD COLUMN click_source text;

-- Add index for analytics queries
CREATE INDEX idx_newsletter_clicks_business ON newsletter_clicks(business_id);
CREATE INDEX idx_newsletter_clicks_placement ON newsletter_clicks(ad_placement_id);
CREATE INDEX idx_newsletter_clicks_source ON newsletter_clicks(click_source);

-- Add check constraint for click_source values
ALTER TABLE newsletter_clicks
ADD CONSTRAINT newsletter_clicks_source_check 
CHECK (click_source IN ('newsletter_sponsor', 'web_brief', 'directory', 'social', NULL));