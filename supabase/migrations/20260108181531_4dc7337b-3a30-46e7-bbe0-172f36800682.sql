-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add features array to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS price_range text,
ADD COLUMN IF NOT EXISTS reservation_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS opentable_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS google_place_id text;

-- Create restaurant_deals table for detailed deal tracking with evidence
CREATE TABLE IF NOT EXISTS public.restaurant_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Deal classification
  deal_type text NOT NULL, -- fish_fry, happy_hour, brunch, weekly_special, kids_deal, late_night
  name text NOT NULL,
  
  -- Scheduling
  days text[] DEFAULT '{}', -- ['Friday'], ['Monday', 'Tuesday', 'Wednesday']
  start_time text, -- '4pm', '11am'
  end_time text, -- '7pm', '2pm'
  
  -- Details
  description text,
  price text, -- '$14.99', '$16.95-$18.95'
  
  -- Fish fry specific
  fish_type text, -- cod, perch, walleye, bluegill
  all_you_can_eat boolean DEFAULT false,
  sides text,
  
  -- Happy hour specific
  drink_deals text[], -- ['$3 domestic beers', '$5 house wines']
  food_deals text[], -- ['Half-price appetizers']
  
  -- Evidence & trust
  verification_status text DEFAULT 'unverified', -- unverified, verified, outdated, conflict
  verification_method text, -- scraped_text, pdf, staff_confirmed, user_photo, facebook_post
  evidence_url text, -- exact URL where this was found
  evidence_snippet text, -- short quote from page
  last_confirmed_at timestamp with time zone,
  
  -- Metadata
  source_type text DEFAULT 'scraper', -- scraper, submission, manual
  submitted_by uuid,
  confidence_score numeric,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_type ON public.restaurant_deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_restaurant ON public.restaurant_deals(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_verification ON public.restaurant_deals(verification_status);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_days ON public.restaurant_deals USING GIN(days);

-- Enable RLS
ALTER TABLE public.restaurant_deals ENABLE ROW LEVEL SECURITY;

-- Public can view deals
CREATE POLICY "Public can view deals" 
ON public.restaurant_deals 
FOR SELECT 
USING (true);

-- Admins can manage deals
CREATE POLICY "Admins can manage deals" 
ON public.restaurant_deals 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert/update deals (for scraper)
CREATE POLICY "System can insert deals" 
ON public.restaurant_deals 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update deals" 
ON public.restaurant_deals 
FOR UPDATE 
USING (true);

-- Create restaurant_pages table for discovered sub-pages
CREATE TABLE IF NOT EXISTS public.restaurant_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  url text NOT NULL,
  page_type text DEFAULT 'unknown', -- menu, specials, happy_hour, events, about, pdf_menu
  
  -- Content tracking
  last_scraped_at timestamp with time zone,
  content_hash text, -- to detect changes
  is_pdf boolean DEFAULT false,
  pdf_text_extracted text,
  
  -- Status
  status text DEFAULT 'discovered', -- discovered, scraped, failed, outdated
  error_message text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(restaurant_id, url)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_pages_restaurant ON public.restaurant_pages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_pages_type ON public.restaurant_pages(page_type);

ALTER TABLE public.restaurant_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view pages" 
ON public.restaurant_pages 
FOR SELECT 
USING (true);

CREATE POLICY "System full access to pages" 
ON public.restaurant_pages 
FOR ALL 
USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_restaurant_deals_updated_at
BEFORE UPDATE ON public.restaurant_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_pages_updated_at
BEFORE UPDATE ON public.restaurant_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();