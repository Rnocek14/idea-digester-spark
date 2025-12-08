-- Delete stale stories older than 30 days (except recurring events with explicit recurring_days)
DELETE FROM content_queue 
WHERE publish_date < NOW() - INTERVAL '30 days'
  AND (metadata->>'recurring_days' IS NULL OR metadata->>'recurring_days' = '[]')
  AND status IN ('pending', 'published', 'auto_published');