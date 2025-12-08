-- Delete stories older than 14 days to match ingestion gate
-- This ensures query filter and ingestion gate are consistent
DELETE FROM content_queue 
WHERE publish_date < NOW() - INTERVAL '14 days'
  AND (metadata->>'recurring_days' IS NULL OR metadata->>'recurring_days' = '[]' OR metadata->>'recurring_days' = 'null')
  AND status IN ('pending', 'published', 'auto_published');