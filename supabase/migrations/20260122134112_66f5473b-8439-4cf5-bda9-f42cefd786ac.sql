-- Clean up low-quality nightlife events with no performer and generic titles
-- These were created by earlier scrapes before the improved AI extraction

DELETE FROM content_queue 
WHERE category = 'events' 
  AND (metadata->>'verticals')::jsonb ? 'nightlife'
  AND event_date >= CURRENT_DATE
  AND performer IS NULL
  AND (
    -- Generic DJ events with no specific name
    title ILIKE 'DJ at %' 
    OR title ILIKE 'DJ Event at %'
    -- Generic "Night X Live Music at Venue -" pattern with no performer
    OR (title ILIKE '%Live Music at %' AND title LIKE '%- ' AND title ILIKE ANY(ARRAY['%Friday Night%', '%Saturday Night%', '%Sunday%']))
  );