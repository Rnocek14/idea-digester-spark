
ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_type_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_type_check
  CHECK (type = ANY (ARRAY['rss'::text, 'api'::text, 'scrape'::text, 'firecrawl'::text, 'diy-scrape'::text, 'manual'::text, 'webhook'::text]));

DELETE FROM public.sources WHERE id = '0fb5ec14-c961-4153-9596-863b26d074f3';

UPDATE public.sources
SET
  type = 'webhook',
  status = 'active',
  category = 'news',
  default_geo_tier = 1,
  source_trust_score = 9,
  fetch_frequency_minutes = 30,
  trust_locality = true,
  metadata = jsonb_build_object(
    'description', 'Hyperlocal Lake Geneva newspaper, ingested via n8n Puppeteer workflow on the VPS (Cloudflare-protected source).',
    'ingestion', 'n8n-puppeteer',
    'webhook_endpoint', 'ingest-news',
    'cloudflare_protected', true,
    'requires_browser', true,
    'is_local_paper', true,
    'location_tags', jsonb_build_array('Lake Geneva'),
    'priority_boost', 1.2
  ),
  updated_at = now()
WHERE id = '1cd38cc0-fb4f-4df5-a2cd-93a273abd4d1';
