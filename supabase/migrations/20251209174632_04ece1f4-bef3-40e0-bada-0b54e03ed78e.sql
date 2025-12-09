-- Add cron job for auto-resolve-incidents (runs every 2 hours)
SELECT cron.schedule(
  'auto-resolve-incidents-every-2-hours',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/auto-resolve-incidents',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);