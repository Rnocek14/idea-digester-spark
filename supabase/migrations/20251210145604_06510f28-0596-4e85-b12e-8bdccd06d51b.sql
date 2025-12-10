-- Fix non-producing sources - disable from sync-rss

-- 1. Disable Walworth County Government News (no working RSS)
UPDATE sources 
SET status = 'inactive'
WHERE name = 'Walworth County Government News';

-- 2. Disable Patch from sync-rss (uses dedicated sync-patch function instead)
UPDATE sources 
SET status = 'inactive',
    metadata = metadata || '{"use_dedicated_function": "sync-patch"}'::jsonb
WHERE name = 'Patch Lake Geneva';