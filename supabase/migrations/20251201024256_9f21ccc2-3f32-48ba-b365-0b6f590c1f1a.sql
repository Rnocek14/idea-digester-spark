-- Newsletter analytics tracking tables

-- Table to store individual email open events
CREATE TABLE IF NOT EXISTS public.newsletter_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  subscriber_email TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store individual link click events
CREATE TABLE IF NOT EXISTS public.newsletter_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  subscriber_email TEXT,
  link_url TEXT NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_opens_newsletter ON public.newsletter_opens(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_opens_subscriber ON public.newsletter_opens(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_opens_opened_at ON public.newsletter_opens(opened_at);

CREATE INDEX IF NOT EXISTS idx_newsletter_clicks_newsletter ON public.newsletter_clicks(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_clicks_subscriber ON public.newsletter_clicks(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_clicks_clicked_at ON public.newsletter_clicks(clicked_at);

-- RLS Policies for opens
ALTER TABLE public.newsletter_opens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all opens"
  ON public.newsletter_opens FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert opens"
  ON public.newsletter_opens FOR INSERT
  WITH CHECK (true);

-- RLS Policies for clicks
ALTER TABLE public.newsletter_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all clicks"
  ON public.newsletter_clicks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert clicks"
  ON public.newsletter_clicks FOR INSERT
  WITH CHECK (true);