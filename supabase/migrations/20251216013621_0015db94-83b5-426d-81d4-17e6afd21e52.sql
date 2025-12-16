-- Re-enable City of Lake Geneva Calendar source now that we fixed the scraper
UPDATE sources 
SET status = 'active'
WHERE name = 'City of Lake Geneva Calendar';

-- Schedule Downtown Lake Geneva Events sync (daily at 5:30 AM and 3 PM Central = 11:30 UTC and 21:00 UTC)
SELECT cron.schedule(
  'sync-downtown-events-morning',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lguehnefdkpnrhsnfyhn.supabase.co/functions/v1/sync-downtown-events',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndWVobmVmZGtwbnJoc25meWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0Mjk5ODcsImV4cCI6MjA0OTAwNTk4N30.bZILxRvcnvIJhOPxxuIi8Iu8gQflVQc8p_7bxIgssEk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'sync-downtown-events-afternoon',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lguehnefdkpnrhsnfyhn.supabase.co/functions/v1/sync-downtown-events',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndWVobmVmZGtwbnJoc25meWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0Mjk5ODcsImV4cCI6MjA0OTAwNTk4N30.bZILxRvcnvIJhOPxxuIi8IU8gQflVQc8p_7bxIgssEk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule City of Lake Geneva Calendar sync (daily at 6 AM Central = 12:00 UTC)
SELECT cron.schedule(
  'sync-city-calendar',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lguehnefdkpnrhsnfyhn.supabase.co/functions/v1/sync-city-calendar',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndWVobmVmZGtwbnJoc25meWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0Mjk5ODcsImV4cCI6MjA0OTAwNTk4N30.bZILxRvcnvIJhOPxxuIi8IU8gQflVQc8p_7bxIgssEk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);