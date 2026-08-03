-- Monthly refresh of real_estate_metrics from Zillow's public research CSVs.
--
-- The table was hand-seeded once (Dec 2024) and had no writer anywhere in the
-- codebase, so /market-report served 19-month-old figures under an "updated
-- monthly" banner. The refresh-real-estate-metrics function fixes that; this
-- schedules it. Zillow publishes ZHVI updates around the middle of each month,
-- so the 18th catches the fresh file without racing it.
SELECT cron.schedule(
  'refresh-real-estate-monthly',
  '0 13 18 * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/refresh-real-estate-metrics',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
