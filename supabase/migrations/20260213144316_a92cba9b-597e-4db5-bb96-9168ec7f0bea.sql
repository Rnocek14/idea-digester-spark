
-- 1) Add hold_reason and decision_path as first-class columns
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS decision_path TEXT;

-- 2) Index hold_reason for ops queries
CREATE INDEX IF NOT EXISTS idx_content_queue_hold_reason ON public.content_queue (hold_reason) WHERE hold_reason IS NOT NULL;

-- 3) Backfill hold_reason from metadata for existing pending stories
UPDATE public.content_queue
SET hold_reason = (metadata->>'hold_reason')
WHERE status = 'pending' 
  AND hold_reason IS NULL 
  AND metadata->>'hold_reason' IS NOT NULL;

-- 4) Backfill inferred hold_reason for pending stories without metadata
UPDATE public.content_queue
SET hold_reason = CASE
  WHEN safety_level = 'sensitive' THEN 'sensitive'
  WHEN safety_level = 'soft_sensitive' AND COALESCE(geo_tier, 0) < 1 THEN 'soft_sensitive_regional'
  WHEN safety_level = 'blocked' THEN 'blocked_content'
  ELSE 'awaiting_review'
END
WHERE status = 'pending' AND hold_reason IS NULL;

-- 5) Canary view: pending stories that SHOULD have been auto-published
CREATE OR REPLACE VIEW public.canary_stuck_stories AS
SELECT cq.id, cq.title, cq.safety_level, cq.geo_tier, cq.category, cq.hold_reason, cq.created_at, s.name as source_name
FROM public.content_queue cq
LEFT JOIN public.sources s ON s.id = cq.source_id
WHERE cq.status = 'pending'
  AND (
    cq.safety_level = 'safe'
    OR (cq.safety_level = 'soft_sensitive' AND COALESCE(cq.geo_tier, 0) >= 1)
  )
  AND cq.reviewed_by IS NULL
ORDER BY cq.created_at DESC;
