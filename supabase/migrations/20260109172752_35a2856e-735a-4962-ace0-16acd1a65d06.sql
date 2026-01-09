-- Add pending_review to allowed status values for editorial review workflow
ALTER TABLE public.content_queue 
DROP CONSTRAINT content_queue_status_check;

ALTER TABLE public.content_queue 
ADD CONSTRAINT content_queue_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'published'::text, 'auto_published'::text, 'flagged'::text, 'blocked'::text, 'expired'::text]));