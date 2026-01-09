-- Add proper snapshot linkage to content_queue
ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS data_snapshot_id UUID REFERENCES public.data_snapshots(id);

-- Add index for snapshot lookups
CREATE INDEX IF NOT EXISTS idx_content_queue_snapshot ON public.content_queue(data_snapshot_id);