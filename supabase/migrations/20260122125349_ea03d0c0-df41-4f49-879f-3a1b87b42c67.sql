-- Backfill existing venue calendar events with nightlife vertical
UPDATE content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{verticals}',
  '["local", "nightlife"]'::jsonb
)
WHERE metadata->>'source_type' = 'venue_calendar'
  AND (metadata->'verticals' IS NULL 
       OR NOT metadata->'verticals' @> '["nightlife"]');