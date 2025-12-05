
-- Add full-queue-prep daily at 6am Central (12pm UTC)
SELECT cron.schedule(
  'full-queue-prep-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/full-queue-prep',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Add backfill-voice-variants every 4 hours
SELECT cron.schedule(
  'backfill-voice-variants-every-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/backfill-voice-variants',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
