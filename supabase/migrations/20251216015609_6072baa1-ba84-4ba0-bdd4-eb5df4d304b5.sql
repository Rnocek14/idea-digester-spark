-- Disable Geneva Lake West Chamber Events (site blocks cloud IPs entirely)
UPDATE sources SET status = 'inactive' WHERE name = 'Geneva Lake West Chamber Events';

-- Remove cron jobs
SELECT cron.unschedule('sync-geneva-lake-west-chamber-morning');
SELECT cron.unschedule('sync-geneva-lake-west-chamber-afternoon');