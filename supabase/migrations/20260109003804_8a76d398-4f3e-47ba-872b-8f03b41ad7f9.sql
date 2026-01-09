-- Phase 1: Add trust/provenance columns to content_queue
ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'sourced' 
  CHECK (source_type IN ('sourced', 'data_journalism', 'original_reporting', 'sponsored', 'user_submitted'));

ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS trust_labels JSONB DEFAULT '[]';

ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;

-- Phase 2: Create minimal data_snapshots table
CREATE TABLE IF NOT EXISTS public.data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_description TEXT NOT NULL,
  result_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Enable RLS on data_snapshots
ALTER TABLE public.data_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read snapshots (for transparency)
CREATE POLICY "Anyone can read data snapshots"
  ON public.data_snapshots
  FOR SELECT
  USING (true);

-- Only service role can insert/update snapshots
CREATE POLICY "Service role can manage snapshots"
  ON public.data_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add index for expiry queries
CREATE INDEX IF NOT EXISTS idx_data_snapshots_expires_at ON public.data_snapshots(expires_at);

-- Add index for source_type filtering
CREATE INDEX IF NOT EXISTS idx_content_queue_source_type ON public.content_queue(source_type);