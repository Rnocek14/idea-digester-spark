-- Add safety scanning fields to content_queue table
ALTER TABLE public.content_queue
ADD COLUMN safety_level text,
ADD COLUMN safety_tags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN safety_reason text;

COMMENT ON COLUMN public.content_queue.safety_level IS 'Content safety evaluation: safe, sensitive, or blocked';
COMMENT ON COLUMN public.content_queue.safety_tags IS 'Array of safety labels like crime, politics, family, etc.';
COMMENT ON COLUMN public.content_queue.safety_reason IS 'Short explanation of why this safety level was assigned';