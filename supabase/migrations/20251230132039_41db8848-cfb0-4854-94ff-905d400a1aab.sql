-- Re-activate Patch Lake Geneva after Firecrawl credits topped up
UPDATE sources
SET 
  status = 'active',
  metadata = metadata - 'disabled_reason' - 'disabled_at' - 'requires_firecrawl_credits' || jsonb_build_object(
    'credits_topped_up_at', now()::text
  )
WHERE name = 'Patch Lake Geneva';