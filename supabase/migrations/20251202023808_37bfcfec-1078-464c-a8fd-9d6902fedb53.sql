-- Add public SELECT policy to content_queue
-- Allow anonymous users to read only published/auto_published + safe stories
CREATE POLICY "Public can view published safe content"
ON content_queue FOR SELECT
USING (
  status IN ('published', 'auto_published') 
  AND safety_level = 'safe'
);

-- Add public SELECT policy to business_profiles
-- Allow anonymous users to read active business profiles (for sponsor blocks and directory)
CREATE POLICY "Public can view active businesses"
ON business_profiles FOR SELECT
USING (status = 'active');

-- Add public SELECT policy to sources
-- Allow anonymous users to read source names (for the query join)
CREATE POLICY "Public can view sources"
ON sources FOR SELECT
USING (true);