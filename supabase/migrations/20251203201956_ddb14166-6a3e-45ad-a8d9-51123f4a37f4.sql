-- Create system settings table for automation controls
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can read settings" ON public.system_settings
  FOR SELECT USING (true);

-- Seed the automation kill switch (enabled by default)
INSERT INTO public.system_settings (key, value)
VALUES ('automation', '{"enabled": true, "newsletter_enabled": true, "social_enabled": true, "publish_enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- Also auto-publish that last pending safe news story
UPDATE content_queue 
SET status = 'auto_published', updated_at = now()
WHERE status = 'pending' AND safety_level = 'safe';