-- Add package_type to ad_placements to track which ad package was purchased
ALTER TABLE ad_placements
ADD COLUMN package_type text;

-- Add index for package analytics
CREATE INDEX idx_ad_placements_package_type ON ad_placements(package_type);

-- Update existing placements based on slot_id (best guess mapping)
UPDATE ad_placements 
SET package_type = CASE
  WHEN slot_id = 'newsletter_header' THEN 'newsletter_1mo'
  WHEN slot_id = 'newsletter_footer' THEN 'newsletter_1mo'
  WHEN slot_id = 'newsletter_featured' THEN 'newsletter_1mo'
  ELSE 'newsletter_1mo'
END
WHERE package_type IS NULL;