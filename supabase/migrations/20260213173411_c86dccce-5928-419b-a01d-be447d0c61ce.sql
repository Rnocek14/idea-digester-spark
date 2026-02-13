-- Add fetch health tracking columns to sources
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS last_successful_fetch_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_detail text;

-- Backfill last_successful_fetch_at from last_fetched_at for active sources
UPDATE public.sources
SET last_successful_fetch_at = last_fetched_at
WHERE last_fetched_at IS NOT NULL AND last_successful_fetch_at IS NULL;

-- Index for stale source queries
CREATE INDEX IF NOT EXISTS idx_sources_fetch_health
  ON public.sources (status, last_successful_fetch_at)
  WHERE status = 'active';