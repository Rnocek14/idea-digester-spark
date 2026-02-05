-- Delete badly-formatted venue calendar entries that will be replaced with clean ones
DELETE FROM content_queue 
WHERE metadata->>'source_type' = 'venue_calendar'
  AND (
    title ILIKE '%— Visit Lake Geneva%'
    OR title ILIKE '%at % at %'
    OR title ILIKE '%@ % @ %'
    OR (title ILIKE '%Live Music @%' AND performer IS NULL)
    OR title ILIKE '%— Visit Lake Geneva –%'
  )
  AND event_date >= CURRENT_DATE;