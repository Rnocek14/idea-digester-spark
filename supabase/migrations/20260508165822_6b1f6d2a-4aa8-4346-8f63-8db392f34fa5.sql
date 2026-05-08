
-- Repair broken cron jobs (old project ref → current)
SELECT cron.unschedule('sync-city-calendar');
SELECT cron.unschedule('sync-downtown-events-morning');
SELECT cron.unschedule('sync-downtown-events-afternoon');

SELECT cron.schedule(
  'sync-city-calendar',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-city-calendar',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

SELECT cron.schedule(
  'sync-downtown-events-morning',
  '30 11 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-downtown-events',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

SELECT cron.schedule(
  'sync-downtown-events-afternoon',
  '0 21 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-downtown-events',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- Seed source intelligence: trust_locality + capability flags by name pattern
UPDATE public.sources SET
  trust_locality = true,
  source_trust_score = 90,
  default_geo_tier = GREATEST(default_geo_tier, 1)
WHERE lower(name) ~ '(nws|weather service|walworth.*sheriff|sheriff|city of lake geneva|lake geneva.*city|patch.*lake geneva|lake geneva regional news|lakegenevanews)';

UPDATE public.sources SET
  trust_locality = true,
  source_trust_score = 85,
  supports_events = true,
  supports_recurring_events = true,
  default_geo_tier = GREATEST(default_geo_tier, 1)
WHERE lower(name) ~ '(visit lake geneva|downtown lake geneva|grand geneva|abbey|pier 290|geneva theater)';

UPDATE public.sources SET
  supports_events = true
WHERE category IN ('events', 'live-music', 'nightlife')
   OR lower(coalesce(category,'')) ~ '(event|music|festival|concert)';
