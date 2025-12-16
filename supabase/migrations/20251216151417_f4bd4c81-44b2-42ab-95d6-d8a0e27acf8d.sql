
-- Re-activate Sheriff source with correct Firecrawl-compatible URL
UPDATE sources
SET 
  status = 'active',
  url = 'https://www.co.walworth.wi.us/747/News-Releases',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'disabled_reason', null,
    'reactivated_at', now()::text,
    'sync_function', 'sync-sheriff-releases',
    'uses_firecrawl', true
  )
WHERE name = 'Walworth County Sheriff News';
