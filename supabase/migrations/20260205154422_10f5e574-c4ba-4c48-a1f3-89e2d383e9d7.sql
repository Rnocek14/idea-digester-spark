-- Clean up all remaining messy venue calendar entries
DELETE FROM content_queue 
WHERE metadata->>'source_type' = 'venue_calendar'
  AND event_date >= CURRENT_DATE
  AND (
    -- Visit Lake Geneva with bad format in title
    title ILIKE '%@ Visit Lake Geneva%'
    OR title ILIKE '%— Visit Lake Geneva%'
    -- Old format with em-dash and venue duplication  
    OR title ILIKE '%—%'
    -- Generic entries without specific performer
    OR (title ILIKE 'Live Music%' AND performer IS NULL)
    OR (title ILIKE 'Live DJ%' AND performer IS NULL)
  );