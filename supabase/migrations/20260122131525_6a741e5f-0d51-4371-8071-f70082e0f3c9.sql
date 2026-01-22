-- Delete broken Pier 290 Calendar entry (duplicate URL exists)
DELETE FROM sources WHERE name = 'Pier 290 Calendar';

-- Disable Oakfire - no public events page
UPDATE sources SET status = 'inactive' WHERE name = 'Oakfire Pizza Events';

-- Re-enable Sprecher's
UPDATE sources 
SET 
  status = 'active',
  metadata = COALESCE(metadata, '{}'::jsonb) - 'last_error' - 'consecutive_failures' - 'disabled_at' - 'disabled_reason' - 'last_error_at'
WHERE name = 'Sprecher''s Restaurant Events';

-- Re-enable Crafted Americana
UPDATE sources 
SET 
  status = 'active',
  metadata = COALESCE(metadata, '{}'::jsonb) - 'last_error' - 'consecutive_failures' - 'disabled_at' - 'disabled_reason' - 'last_error_at'
WHERE name = 'Crafted Americana Events';