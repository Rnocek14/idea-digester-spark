-- Create incident for current active Winter Weather Advisory
INSERT INTO incidents (slug, title, incident_type, status, location, source_story_id, priority_score, started_at)
VALUES (
  'winter-weather-advisory-dec-9-2025',
  'Winter Weather Advisory until December 10 at 6:00AM',
  'weather',
  'monitoring',
  'Walworth County / Lake Geneva area',
  'cfa0aa2f-9f66-4448-ba06-0563ec9b42fa',
  3,
  '2025-12-09T16:15:05.660217+00'
);

-- Add an incident update
INSERT INTO incident_updates (incident_id, source, source_label, text, is_verified, story_id)
SELECT 
  id,
  'nws',
  'National Weather Service',
  'Winter Weather Advisory in effect. 3-5 inches of snow expected. Plan for slippery road conditions.',
  true,
  source_story_id
FROM incidents 
WHERE slug = 'winter-weather-advisory-dec-9-2025';