-- First, clean up existing duplicates by keeping only the newest entry for each normalized_url
-- Then add unique constraint

WITH duplicates AS (
  SELECT id, normalized_url,
    ROW_NUMBER() OVER (PARTITION BY normalized_url ORDER BY created_at DESC) as rn
  FROM public.content_queue
  WHERE normalized_url IS NOT NULL
)
DELETE FROM public.content_queue
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_queue_normalized_url_unique 
ON public.content_queue (normalized_url) 
WHERE normalized_url IS NOT NULL;