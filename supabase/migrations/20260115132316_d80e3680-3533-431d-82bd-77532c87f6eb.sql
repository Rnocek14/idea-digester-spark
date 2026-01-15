-- HYPERLOCAL LOCKDOWN: Clean up non-local content

-- Phase 1: Reject non-local stories from content_queue
UPDATE content_queue
SET status = 'rejected',
    reviewed_at = now()
WHERE status IN ('pending', 'approved', 'auto_published')
  AND (
    title ILIKE '%milwaukee%'
    OR title ILIKE '%madison%'  
    OR title ILIKE '%chicago%'
    OR title ILIKE '%racine%'
    OR title ILIKE '%kenosha%'
    OR title ILIKE '%waukesha%'
    OR title ILIKE '%janesville%'
    OR title ILIKE '%beloit%'
    OR title ILIKE '%rockford%'
    OR title ILIKE '%green bay%'
    OR title ILIKE '%appleton%'
    OR title ILIKE '%oshkosh%'
    OR title ILIKE '%minneapolis%'
    OR title ILIKE '%iran%'
  )
  AND title NOT ILIKE '%lake geneva%'
  AND title NOT ILIKE '%walworth%'
  AND title NOT ILIKE '%fontana%'
  AND title NOT ILIKE '%williams bay%';

-- Phase 2: Resolve non-local incidents
UPDATE incidents
SET status = 'resolved',
    resolution_reason = 'non_local_cleanup',
    resolved_at = now()
WHERE status IN ('active', 'monitoring')
  AND (
    title ILIKE '%milwaukee%'
    OR title ILIKE '%madison%'
    OR title ILIKE '%minneapolis%'
    OR title ILIKE '%iran%'
    OR title ILIKE '%chicago%'
    OR title ILIKE '%kenosha%'
    OR title ILIKE '%racine%'
    OR title ILIKE '%waukesha%'
  )
  AND (location IS NULL OR location NOT ILIKE '%lake geneva%')
  AND (location IS NULL OR location NOT ILIKE '%walworth%');

-- Phase 3: Weather deduplication - keep only most recent per type
WITH ranked_weather AS (
  SELECT id, title, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN title ILIKE '%winter storm%' OR title ILIKE '%winter weather%' THEN 'winter'
          WHEN title ILIKE '%wind%' THEN 'wind'
          WHEN title ILIKE '%fog%' THEN 'fog'
          WHEN title ILIKE '%freeze%' OR title ILIKE '%frost%' THEN 'freeze'
          WHEN title ILIKE '%heat%' THEN 'heat'
          ELSE 'other_weather'
        END
      ORDER BY created_at DESC
    ) as rn
  FROM content_queue
  WHERE category = 'weather'
    AND status IN ('auto_published', 'published', 'approved')
)
UPDATE content_queue
SET status = 'expired'
WHERE id IN (
  SELECT id FROM ranked_weather WHERE rn > 1
);