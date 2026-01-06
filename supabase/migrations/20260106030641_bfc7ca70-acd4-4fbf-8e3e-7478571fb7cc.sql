-- Create table to track job listing clicks
CREATE TABLE public.job_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'website',
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  newsletter_id uuid REFERENCES public.newsletters(id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_job_clicks_job_id ON public.job_clicks(job_id);
CREATE INDEX idx_job_clicks_clicked_at ON public.job_clicks(clicked_at);

-- Enable RLS
ALTER TABLE public.job_clicks ENABLE ROW LEVEL SECURITY;

-- System can insert clicks
CREATE POLICY "System can insert job clicks"
ON public.job_clicks
FOR INSERT
WITH CHECK (true);

-- System can read clicks (for aggregation)
CREATE POLICY "System can read job clicks"
ON public.job_clicks
FOR SELECT
USING (true);

-- Admins can manage all clicks
CREATE POLICY "Admins can manage job clicks"
ON public.job_clicks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));