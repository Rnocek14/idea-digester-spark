-- Add cron job for sync-sheriff-releases (twice daily at 7am and 5pm CT = 13:00 and 23:00 UTC)
SELECT cron.schedule(
  'sync-sheriff-releases-twice-daily',
  '0 13,23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-sheriff-releases',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Add cron job for sync-power-outages (every 15 minutes)
SELECT cron.schedule(
  'sync-power-outages-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-power-outages',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);