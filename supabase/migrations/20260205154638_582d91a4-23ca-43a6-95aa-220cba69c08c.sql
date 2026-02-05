-- Clean up old Visit Lake Geneva entries with messy format to be replaced with clean ones
DELETE FROM content_queue 
WHERE metadata->>'source_type' = 'venue_calendar'
  AND event_date >= CURRENT_DATE
  AND (
    metadata->>'venue' = 'Visit Lake Geneva –'
    OR metadata->>'venue' ILIKE '%Visit Lake Geneva%'
    OR title ILIKE '%@ Visit Lake Geneva%'
  );