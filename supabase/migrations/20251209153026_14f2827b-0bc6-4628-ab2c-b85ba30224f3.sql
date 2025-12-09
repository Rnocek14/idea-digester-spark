-- Add newsletter_type column to differentiate daily vs weekend editions
ALTER TABLE newsletters
ADD COLUMN IF NOT EXISTS newsletter_type text DEFAULT 'daily';

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_newsletters_type ON newsletters(newsletter_type);