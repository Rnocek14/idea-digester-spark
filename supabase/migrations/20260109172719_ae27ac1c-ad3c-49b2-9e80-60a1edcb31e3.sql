-- Add local_context_feature to allowed source_type values
ALTER TABLE public.content_queue 
DROP CONSTRAINT content_queue_source_type_check;

ALTER TABLE public.content_queue 
ADD CONSTRAINT content_queue_source_type_check 
CHECK (source_type = ANY (ARRAY['sourced'::text, 'data_journalism'::text, 'original_reporting'::text, 'sponsored'::text, 'user_submitted'::text, 'local_context_feature'::text]));