-- Backfill event_date from metadata.raw_event_date for nightlife events
UPDATE content_queue
SET event_date = (metadata->>'raw_event_date')::date
WHERE event_date IS NULL
  AND metadata->>'raw_event_date' IS NOT NULL
  AND (metadata->>'raw_event_date')::date >= CURRENT_DATE
  AND category = 'events';