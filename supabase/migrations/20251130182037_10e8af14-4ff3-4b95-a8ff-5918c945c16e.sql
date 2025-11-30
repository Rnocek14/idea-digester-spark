-- Create newsletters table for tracking generated editions
CREATE TABLE public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'skipped', 'error')),
  subject TEXT NOT NULL,
  preheader TEXT,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  story_ids UUID[] NOT NULL DEFAULT '{}',
  story_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add deduplication column to content_queue
ALTER TABLE public.content_queue
ADD COLUMN last_newsletter_id UUID REFERENCES public.newsletters(id);

-- Create index for efficient newsletter queries
CREATE INDEX idx_newsletters_edition_date ON public.newsletters(edition_date DESC);
CREATE INDEX idx_newsletters_status ON public.newsletters(status);
CREATE INDEX idx_content_queue_last_newsletter ON public.content_queue(last_newsletter_id);

-- Enable RLS
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin-only access)
CREATE POLICY "Admins can view all newsletters"
ON public.newsletters
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert newsletters"
ON public.newsletters
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update newsletters"
ON public.newsletters
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete newsletters"
ON public.newsletters
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System actors (edge functions with service role) can insert via service role key
CREATE POLICY "System can insert newsletters"
ON public.newsletters
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "System can update newsletters"
ON public.newsletters
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_newsletters_updated_at
BEFORE UPDATE ON public.newsletters
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();