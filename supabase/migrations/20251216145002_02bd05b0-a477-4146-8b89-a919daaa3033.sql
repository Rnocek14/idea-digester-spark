
-- Mark 8 stale "ready" newsletters as skipped (Dec 1-8)
UPDATE newsletters
SET 
  status = 'skipped',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'skipped_reason', 'stale_ready_cleanup',
    'skipped_at', now()::text
  )
WHERE status = 'ready'
  AND edition_date < CURRENT_DATE - INTERVAL '1 day';
