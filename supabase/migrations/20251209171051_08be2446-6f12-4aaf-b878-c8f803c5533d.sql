-- Add Weekend Guide cron job (Thursday 4PM Central = 22:00 UTC)
SELECT cron.schedule(
  'weekly-weekend-guide',
  '0 22 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/autopilot-weekend-newsletter',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"sendNow": true}'::jsonb
  );
  $$
);

-- Add Gina Nocek to sponsors table for Weekend Guide
INSERT INTO sponsors (
  business_name,
  status,
  tier,
  logo_url,
  website,
  email,
  contact_name,
  metadata
) VALUES (
  'Gina Nocek Real Estate',
  'active',
  'premium',
  'https://mzumvkrpnxhkvhdyzgqa.supabase.co/storage/v1/object/public/sponsor-assets/0a59e51c-17d7-4ae7-803a-87241c4273b5.jpg',
  'https://www.atproperties.com/agents/4659/gina-nocek',
  'gnocek@atproperties.com',
  'Gina Nocek',
  '{"short_tagline": "Lake Geneva''s trusted real estate expert"}'::jsonb
);