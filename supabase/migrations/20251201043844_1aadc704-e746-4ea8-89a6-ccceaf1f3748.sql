-- Create post_queue table for social media posting automation
CREATE TABLE public.post_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.content_queue(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'x', 'website')),
  post_text TEXT NOT NULL,
  image_url TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'simulated')),
  error_message TEXT,
  external_post_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient queue processing
CREATE INDEX idx_post_queue_scheduled ON public.post_queue(scheduled_for, status);
CREATE INDEX idx_post_queue_story_platform ON public.post_queue(story_id, platform);

-- Enable RLS
ALTER TABLE public.post_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins
CREATE POLICY "Admins can view all posts"
  ON public.post_queue
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert posts"
  ON public.post_queue
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update posts"
  ON public.post_queue
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete posts"
  ON public.post_queue
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can update posts (for edge functions)
CREATE POLICY "System can update posts"
  ON public.post_queue
  FOR UPDATE
  USING (true);

-- System can insert posts (for edge functions)
CREATE POLICY "System can insert posts"
  ON public.post_queue
  FOR INSERT
  WITH CHECK (true);