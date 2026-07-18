-- Self-healing source maintenance: daily at 4:30am CT. Auto-retires long-dead
-- sources and expires stale newsletters — cleanup that previously required a
-- human in the dashboard. Zero-touch fleet hygiene.
SELECT cron.schedule(
  'auto-maintain-sources-daily',
  '30 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/auto-maintain-sources',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
