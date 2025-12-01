-- Add image_source column to content_queue to track image provenance
ALTER TABLE public.content_queue 
ADD COLUMN image_source TEXT;

COMMENT ON COLUMN public.content_queue.image_source IS 
'Tracks where the image came from: source_og (from OG tags), source_site (explicit from source), local_upload, ai_generated, stock, or null if no image';