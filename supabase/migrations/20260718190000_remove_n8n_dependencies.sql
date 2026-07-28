-- Remove the n8n/VPS dependency from ingestion.
--
-- Three jobs were outsourced to an external n8n VPS. Two have native
-- replacements that already exist in this repo but were never scheduled; the
-- third (Facebook) is replaced by email ingestion rather than scraping.
--
--   1. lakegenevanews.net Puppeteer  -> scrape-lakegenevanews (Firecrawl), cron below
--   2. County/Sheriff CivicEngage    -> sync-rss's Firecrawl fallback for type='scrape'
--   3. Facebook page scraping        -> ingest-email (Nixle / listservs / press releases)
--
-- Nothing here depends on a machine you have to keep alive.

-- 1) Paper of record via Firecrawl, hourly. The function is idempotent
--    (normalized_url dedupe in ingest-news) so overlapping runs are harmless.
SELECT cron.schedule(
  'scrape-lakegenevanews-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/scrape-lakegenevanews',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2) Email ingestion every 10 minutes (no-ops until Gmail creds are set).
SELECT cron.schedule(
  'ingest-email-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) Reactivate the Cloudflare-protected county sources as scrape-type so
--    sync-rss fetches them through its Firecrawl fallback instead of waiting
--    on an n8n webhook that was never built. If Firecrawl can't get through
--    either, the zero-run health counters + auto-maintain-sources will retire
--    them automatically — no human follow-up required.
UPDATE public.sources
SET status = 'active',
    type = 'scrape',
    metadata = COALESCE(metadata, '{}'::jsonb)
      - 'requires_n8n'
      - 'setup_required'
      || jsonb_build_object(
        'ingestion_method', 'firecrawl',
        'requires_browser', true,
        'reactivated_at', '2026-07-18',
        'note', 'Cloudflare-protected; fetched via sync-rss Firecrawl fallback'
      )
WHERE status = 'inactive'
  AND (
    metadata->>'ingestion_method' = 'n8n_webhook'
    OR metadata->>'requires_n8n' = 'true'
  );

-- 4) Email source bindings. A sources row with metadata.email_from binds a
--    sender address to a city; ingest-email ignores every unknown sender.
--    Seeded inactive: activate each one as you subscribe the inbox to it.
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, city_id, metadata)
VALUES
  (
    'Nixle – Walworth County (email)',
    'api',
    'mailto:nixle-walworth',
    'safety',
    'inactive',
    10,
    1,
    'default',
    '{"email_from": "alerts@nixle.com", "email_source_type": "nixle", "trusted_source": true, "note": "Subscribe the ingest inbox at nixle.com with the city ZIP, then set status=active"}'::jsonb
  ),
  (
    'City of Lake Geneva – notifications (email)',
    'api',
    'mailto:lakegeneva-city-notify',
    'civic',
    'inactive',
    10,
    1,
    'default',
    '{"email_from": "noreply@cityoflakegeneva.gov", "email_source_type": "official", "trusted_source": true, "note": "Subscribe the ingest inbox to the city notification list, then set status=active"}'::jsonb
  )
ON CONFLICT (url) DO NOTHING;
