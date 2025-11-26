-- Add foreign key constraint from content_queue to sources
ALTER TABLE public.content_queue
  ADD CONSTRAINT content_queue_source_fk
  FOREIGN KEY (source_id)
  REFERENCES public.sources(id)
  ON DELETE SET NULL;