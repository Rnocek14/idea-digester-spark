-- Create incidents table for tracking live incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  incident_type text NOT NULL, -- 'accident' | 'fire' | 'weather' | 'police' | 'utility' | 'other'
  status text NOT NULL DEFAULT 'active', -- 'active' | 'monitoring' | 'resolved' | 'false_alarm'
  location text,
  source_story_id uuid REFERENCES public.content_queue(id) ON DELETE SET NULL,
  priority_score integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create incident_updates table for timeline entries
CREATE TABLE IF NOT EXISTS public.incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL, -- 'rss' | 'nws' | 'system' | 'editor' | 'other'
  source_label text,    -- e.g. 'City of Lake Geneva', 'NWS'
  text text NOT NULL,
  is_verified boolean NOT NULL DEFAULT true,
  story_id uuid REFERENCES public.content_queue(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_updated ON public.incidents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON public.incident_updates(incident_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;

-- Public read access for active/monitoring incidents
CREATE POLICY "Public can view active incidents" ON public.incidents
  FOR SELECT USING (status IN ('active', 'monitoring', 'resolved'));

CREATE POLICY "Admins can manage incidents" ON public.incidents
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read access for incident updates
CREATE POLICY "Public can view incident updates" ON public.incident_updates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage incident updates" ON public.incident_updates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- System insert policies for edge functions
CREATE POLICY "System can insert incidents" ON public.incidents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update incidents" ON public.incidents
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "System can insert incident updates" ON public.incident_updates
  FOR INSERT WITH CHECK (true);