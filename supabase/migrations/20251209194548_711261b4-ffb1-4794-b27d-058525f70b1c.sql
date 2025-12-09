
-- Fix content mix: Adjust VLG fetch frequency and unlock TMJ4 Regional news

-- Fix 1: Change Visit Lake Geneva fetch frequency from 120 → 360 minutes (6 hours)
-- This reduces event flood without breaking the pipeline
UPDATE sources 
SET fetch_frequency_minutes = 360,
    updated_at = now()
WHERE id = 'b219479c-5c29-49d0-82df-adaa230e8761';

-- Fix 2: Remove regional flag from TMJ4 Regional to unlock news content
-- The regional=true flag was causing all content to be geo-filtered out
-- Keep default_geo_tier=2 and trust_locality for proper categorization
UPDATE sources 
SET metadata = metadata - 'regional',
    updated_at = now()
WHERE id = 'fdaff72a-45b8-4248-8d1d-5afdae638487';
