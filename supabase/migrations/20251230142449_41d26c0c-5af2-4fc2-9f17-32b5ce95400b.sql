-- =====================================================
-- CLEAN UP EXISTING DUPLICATE WEATHER ALERTS
-- Keep only the most recent published alert per event type
-- =====================================================

-- Step 1: Mark duplicate weather alerts as rejected (keep newest of each type)
WITH weather_ranked AS (
  SELECT id, title, created_at,
    CASE 
      WHEN title ILIKE '%Wind%Advisory%' OR title ILIKE '%Wind%Warning%' THEN 'wind'
      WHEN title ILIKE '%Winter Weather%' OR title ILIKE '%Winter Storm%' THEN 'winter'
      WHEN title ILIKE '%Dense Fog%' THEN 'fog'
      WHEN title ILIKE '%Tornado%' THEN 'tornado'
      WHEN title ILIKE '%Flood%' THEN 'flood'
      WHEN title ILIKE '%Thunderstorm%' THEN 'thunderstorm'
      WHEN title ILIKE '%Heat%' THEN 'heat'
      WHEN title ILIKE '%Freeze%' OR title ILIKE '%Frost%' THEN 'freeze'
      WHEN title ILIKE '%Blizzard%' THEN 'blizzard'
      WHEN title ILIKE '%Ice Storm%' THEN 'ice'
      WHEN title ILIKE '%Snow%' THEN 'snow'
      ELSE 'other_weather'
    END as event_type,
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN title ILIKE '%Wind%Advisory%' OR title ILIKE '%Wind%Warning%' THEN 'wind'
          WHEN title ILIKE '%Winter Weather%' OR title ILIKE '%Winter Storm%' THEN 'winter'
          WHEN title ILIKE '%Dense Fog%' THEN 'fog'
          WHEN title ILIKE '%Tornado%' THEN 'tornado'
          WHEN title ILIKE '%Flood%' THEN 'flood'
          WHEN title ILIKE '%Thunderstorm%' THEN 'thunderstorm'
          WHEN title ILIKE '%Heat%' THEN 'heat'
          WHEN title ILIKE '%Freeze%' OR title ILIKE '%Frost%' THEN 'freeze'
          WHEN title ILIKE '%Blizzard%' THEN 'blizzard'
          WHEN title ILIKE '%Ice Storm%' THEN 'ice'
          WHEN title ILIKE '%Snow%' THEN 'snow'
          ELSE 'other_weather'
        END
      ORDER BY created_at DESC
    ) as rn
  FROM content_queue
  WHERE category = 'weather'
    AND status IN ('auto_published', 'published')
)
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'superseded_reason', 'Duplicate weather alert - keeping only most recent',
    'superseded_at', now()::text
  )
WHERE id IN (
  SELECT id FROM weather_ranked WHERE rn > 1
);

-- Step 2: Resolve duplicate weather incidents (keep newest of each type)
-- Using updated_at since incidents table doesn't have created_at
WITH incident_ranked AS (
  SELECT id, title, updated_at,
    CASE 
      WHEN title ILIKE '%Wind%' THEN 'wind'
      WHEN title ILIKE '%Winter%' THEN 'winter'
      WHEN title ILIKE '%Fog%' THEN 'fog'
      WHEN title ILIKE '%Tornado%' THEN 'tornado'
      WHEN title ILIKE '%Flood%' THEN 'flood'
      WHEN title ILIKE '%Thunderstorm%' THEN 'thunderstorm'
      WHEN title ILIKE '%Heat%' THEN 'heat'
      WHEN title ILIKE '%Freeze%' OR title ILIKE '%Frost%' THEN 'freeze'
      WHEN title ILIKE '%Blizzard%' THEN 'blizzard'
      WHEN title ILIKE '%Ice%' THEN 'ice'
      WHEN title ILIKE '%Snow%' THEN 'snow'
      ELSE 'other_weather'
    END as event_type,
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN title ILIKE '%Wind%' THEN 'wind'
          WHEN title ILIKE '%Winter%' THEN 'winter'
          WHEN title ILIKE '%Fog%' THEN 'fog'
          WHEN title ILIKE '%Tornado%' THEN 'tornado'
          WHEN title ILIKE '%Flood%' THEN 'flood'
          WHEN title ILIKE '%Thunderstorm%' THEN 'thunderstorm'
          WHEN title ILIKE '%Heat%' THEN 'heat'
          WHEN title ILIKE '%Freeze%' OR title ILIKE '%Frost%' THEN 'freeze'
          WHEN title ILIKE '%Blizzard%' THEN 'blizzard'
          WHEN title ILIKE '%Ice%' THEN 'ice'
          WHEN title ILIKE '%Snow%' THEN 'snow'
          ELSE 'other_weather'
        END
      ORDER BY updated_at DESC
    ) as rn
  FROM incidents
  WHERE incident_type = 'weather'
    AND status IN ('active', 'monitoring')
)
UPDATE incidents
SET 
  status = 'resolved',
  resolved_at = now(),
  resolution_reason = 'Superseded by newer weather alert of same type'
WHERE id IN (
  SELECT id FROM incident_ranked WHERE rn > 1
);