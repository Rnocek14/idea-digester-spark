-- Create advertiser_leads table for managing advertiser inquiries
CREATE TABLE public.advertiser_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'advertise_page',
  status TEXT NOT NULL DEFAULT 'new',
  business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advertiser_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins only
CREATE POLICY "Admins can view all leads"
  ON public.advertiser_leads
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage leads"
  ON public.advertiser_leads
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can insert leads from contact forms
CREATE POLICY "Anyone can submit leads"
  ON public.advertiser_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_advertiser_leads_updated_at
  BEFORE UPDATE ON public.advertiser_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add index for common queries
CREATE INDEX idx_advertiser_leads_status ON public.advertiser_leads(status);
CREATE INDEX idx_advertiser_leads_created_at ON public.advertiser_leads(created_at DESC);