-- Fully re-activate Patch Lake Geneva (clear all disabled flags)
UPDATE sources
SET 
  status = 'active',
  metadata = jsonb_strip_nulls(
    (metadata - 'disabled_reason' - 'disabled_at' - 'requires_firecrawl_credits') || 
    jsonb_build_object('credits_topped_up_at', now()::text, 'reactivated_at', now()::text)
  )
WHERE name = 'Patch Lake Geneva';

-- Ensure Walworth County Sheriff News is clean and active
UPDATE sources
SET 
  metadata = jsonb_strip_nulls(
    (metadata - 'disabled_reason' - 'disabled_at' - 'requires_firecrawl_credits' - 'last_error' - 'last_error_at') || 
    jsonb_build_object('credits_topped_up_at', now()::text)
  )
WHERE name = 'Walworth County Sheriff News';