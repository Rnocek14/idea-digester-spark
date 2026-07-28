-- Version-control the daily editorial crons and schedule the missing incident
-- source. Previously generate-daily-brief / generate-lake-beat / the daily
-- newsletter existed only as hand-configured dashboard crons (a silent failure
-- there was invisible in code review), and sync-spotcrime-incidents was deployed
-- but never scheduled at all.
--
-- cron.schedule() upserts by job name. autopilot-newsletter has a same-day guard
-- ("newsletter already exists for today"), so a duplicate dashboard cron firing
-- alongside these is a no-op.

-- SpotCrime (now routed through the shared editorial gate): every 2 hours.
SELECT cron.schedule(
  'sync-spotcrime-every-2h',
  '15 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-spotcrime-incidents',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Daily brief (Maggie) at 5:30am CT — must run before the newsletter, which
-- embeds today's brief.
SELECT cron.schedule(
  'generate-daily-brief-morning',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-daily-brief',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Lake beat line at 5:45am CT.
SELECT cron.schedule(
  'generate-lake-beat-morning',
  '45 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-lake-beat',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Daily newsletter at 7:30am CT (after full-queue-prep at 12:00 UTC).
SELECT cron.schedule(
  'autopilot-newsletter-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/autopilot-newsletter',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Source-health digest at 6:00am CT (requires ALERT_EMAIL secret; no-ops otherwise).
SELECT cron.schedule(
  'alert-source-health-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/alert-source-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
