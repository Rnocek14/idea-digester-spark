-- =====================================================
-- FIX REMAINING SYSTEM HEALTH ISSUES (v3)
-- =====================================================

-- 1. FIX MAXWELL MANSION FREQUENCY (Correct source name)
UPDATE sources
SET 
  fetch_frequency_minutes = 1440,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'review_mode', true,
    'frequency_reduced_at', now()::text,
    'frequency_reduced_reason', 'duplicate_flooding'
  )
WHERE name = 'Maxwell Mansion - Events';

-- 2. REJECT pending items that are duplicates of already-published items
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now()
WHERE id IN (
  SELECT cq1.id
  FROM content_queue cq1
  JOIN content_queue cq2 ON cq1.normalized_url = cq2.normalized_url AND cq1.id != cq2.id
  WHERE cq1.status = 'pending'
    AND cq2.status IN ('auto_published', 'published')
);

-- 3. CLEAN remaining duplicates within pending (keep newest)
WITH pending_duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_url
      ORDER BY created_at DESC
    ) as rn
  FROM content_queue
  WHERE status = 'pending'
    AND normalized_url IS NOT NULL
)
UPDATE content_queue
SET 
  status = 'rejected',
  reviewed_at = now()
WHERE id IN (
  SELECT id FROM pending_duplicates WHERE rn > 1
);

-- 4. NOW FORCE DINING AUTO-PUBLISH (safe - no more duplicates)
UPDATE content_queue
SET 
  status = 'auto_published',
  reviewed_at = now(),
  publish_date = COALESCE(publish_date, now())
WHERE 
  status = 'pending'
  AND category = 'dining'
  AND geo_tier >= 1
  AND safety_level = 'safe';