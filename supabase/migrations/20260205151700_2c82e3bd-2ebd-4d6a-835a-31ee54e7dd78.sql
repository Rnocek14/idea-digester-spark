
-- Flag key event sources as venue calendars so sync-venue-calendars processes them
UPDATE sources SET metadata = metadata || '{"venue": true}'::jsonb
WHERE status = 'active'
  AND name IN (
    'PIER 290 - Events',
    'Geneva Tap House - Events', 
    'Maxwell Mansion - Events',
    'Visit Lake Geneva – Events'
  )
  AND (metadata->>'venue' IS NULL OR metadata->>'venue' != 'true');

-- Also fix the Topsy Turvy one that has venue set to the name instead of true
UPDATE sources SET metadata = metadata || '{"venue": true}'::jsonb
WHERE name = 'Topsy Turvy Brewery - Events';
