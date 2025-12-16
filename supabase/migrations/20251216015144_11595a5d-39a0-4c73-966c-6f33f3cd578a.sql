-- Disable Geneva Lake West Chamber Events source (403 blocked)
UPDATE sources SET status = 'inactive' WHERE name = 'Geneva Lake West Chamber Events';

-- Remove the cron jobs for this source since it's blocked
SELECT cron.unschedule('sync-geneva-lake-west-chamber-morning');
SELECT cron.unschedule('sync-geneva-lake-west-chamber-afternoon');