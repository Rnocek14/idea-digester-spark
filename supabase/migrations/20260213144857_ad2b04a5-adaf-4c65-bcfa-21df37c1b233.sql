
-- Composite index for stuck-pending scans, tier mix, canary queries
CREATE INDEX IF NOT EXISTS idx_content_queue_status_safety_geo 
ON public.content_queue (status, safety_level, geo_tier);

-- Index for time-ordered status queries (dashboard, recent pending)
CREATE INDEX IF NOT EXISTS idx_content_queue_status_created 
ON public.content_queue (status, created_at DESC);
