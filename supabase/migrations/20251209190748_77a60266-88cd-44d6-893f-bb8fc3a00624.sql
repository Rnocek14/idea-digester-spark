-- Add cron job for backfill-incidents (runs twice daily at 8 AM and 2 PM Central = 14:00 and 20:00 UTC)
SELECT cron.schedule(
  'backfill-incidents-twice-daily',
  '0 14,20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/backfill-incidents',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"dry_run": false, "min_priority": 4, "days_back": 2}'::jsonb
  ) AS request_id;
  $$
);