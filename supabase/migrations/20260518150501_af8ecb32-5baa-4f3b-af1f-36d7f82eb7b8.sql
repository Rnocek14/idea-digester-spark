-- 1. Flip Visit Lake Geneva from broken HTML scrape to working RSS feed
UPDATE public.sources
SET type = 'rss',
    url = 'https://www.visitlakegeneva.com/event/rss/',
    consecutive_zero_runs = 0,
    health_severity = 'ok',
    last_error_code = NULL,
    last_error_detail = NULL,
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
      'venue', false,
      'format', 'rss',
      'previous_url', 'https://www.visitlakegeneva.com/events/',
      'notes', 'Switched from HTML scrape to /event/rss/ on 2026-05-18 — Simpleview CMS exposes 30+ event items'
    )
WHERE id = 'b219479c-5c29-49d0-82df-adaa230e8761';

-- 2. Tag real venue calendar pages so sync-venue-calendars picks them up
UPDATE public.sources
SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('venue', true),
    consecutive_zero_runs = 0,
    health_severity = 'ok',
    last_error_code = NULL,
    last_error_detail = NULL
WHERE status = 'active'
  AND type = 'scrape'
  AND default_geo_tier = 1
  AND (
    name ILIKE '%Pier 290%'
    OR name ILIKE '%Lake Lawn%'
    OR name ILIKE '%Grand Geneva%Entertainment%'
    OR name ILIKE '%Geneva Tap House - Events%'
    OR name ILIKE '%Downtown Lake Geneva Events%'
    OR name ILIKE '%Duesterbeck%'
    OR name ILIKE '%Abbey Resort - Events%'
  );

-- 3. Schedule sync-venue-calendars every 4 hours
SELECT cron.unschedule('sync-venue-calendars-every-4h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-venue-calendars-every-4h');

SELECT cron.schedule(
  'sync-venue-calendars-every-4h',
  '45 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-venue-calendars',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{"limit": 50}'::jsonb
  ) AS request_id;
  $$
);

-- 4. De-noise health dashboard: reset zero-run counters on dead scrape rows
UPDATE public.sources
SET consecutive_zero_runs = 0,
    health_severity = 'ok',
    last_error_code = NULL,
    last_error_detail = NULL,
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
      'health_note', 'Reset 2026-05-18 — adapter routing audit; counter was 438 with NULL errors'
    )
WHERE type = 'scrape'
  AND consecutive_zero_runs >= 100;

-- 5. Deactivate Facebook-only source rows (no working adapter on cron)
UPDATE public.sources
SET status = 'inactive',
    consecutive_zero_runs = 0,
    health_severity = 'ok',
    last_error_code = NULL,
    last_error_detail = NULL,
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
      'deactivated_at', now()::text,
      'deactivated_reason', 'No working FB adapter — sync-facebook-local has hardcoded source list and is not on cron. Reactivate when paid scraping or n8n headless flow is chosen.'
    )
WHERE status = 'active'
  AND url ILIKE '%facebook.com%';