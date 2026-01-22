-- Mark CivicEngage sources as requiring browser-based fetch (n8n/Firecrawl)
-- They are behind Cloudflare and cannot be fetched from edge functions

UPDATE sources 
SET 
  status = 'inactive',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'requires_browser', true,
    'block_reason', 'Cloudflare bot protection - requires n8n webhook or browser fetch',
    'cloudflare_protected', true,
    'disabled_at', now()::text,
    'disabled_reason', 'Auto-disabled: Cloudflare 403 - set up n8n webhook to ingest'
  )
WHERE url LIKE '%cityoflakegeneva.gov/RSSFeed%';