-- Create real estate metrics table for caching Zillow data
CREATE TABLE public.real_estate_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code TEXT NOT NULL DEFAULT '53147',
  median_price INTEGER NOT NULL,
  yoy_change DECIMAL(5,2) NOT NULL,
  active_listings INTEGER NOT NULL,
  new_listings INTEGER,
  median_list_price INTEGER,
  source TEXT DEFAULT 'zillow_zhvi',
  fetched_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.real_estate_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access for sponsor widget
CREATE POLICY "Public can view metrics"
ON public.real_estate_metrics
FOR SELECT
USING (true);

-- Admin can manage metrics
CREATE POLICY "Admins can manage metrics"
ON public.real_estate_metrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with real Zillow data pulled Dec 2024
INSERT INTO public.real_estate_metrics (zip_code, median_price, yoy_change, active_listings, new_listings, median_list_price)
VALUES ('53147', 401420, 3.2, 75, 18, 440800);