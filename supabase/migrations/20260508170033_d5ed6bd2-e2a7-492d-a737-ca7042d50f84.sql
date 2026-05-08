
SELECT cron.schedule(
  'sync-ical-feeds-every-4h',
  '15 */4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-ical-feeds',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
