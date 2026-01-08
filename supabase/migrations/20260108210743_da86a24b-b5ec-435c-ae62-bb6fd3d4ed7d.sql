-- =============================================
-- FISH FRY GUIDE: Complete Database Schema
-- =============================================

-- 1. Add trust/verification fields to restaurant_deals (if not exists)
DO $$ 
BEGIN
  -- Add last_confirmed_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'last_confirmed_at') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN last_confirmed_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add verification_status if not exists (already exists per schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'verification_status') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN verification_status TEXT DEFAULT 'unverified';
  END IF;
  
  -- Add verification_method if not exists (already exists per schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'verification_method') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN verification_method TEXT DEFAULT 'scraper';
  END IF;
  
  -- Add evidence_url if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'evidence_url') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN evidence_url TEXT;
  END IF;
  
  -- Add evidence_snippet if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'evidence_snippet') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN evidence_snippet TEXT;
  END IF;
  
  -- Add valid_to (for outdated detection)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_deals' AND column_name = 'valid_to') THEN
    ALTER TABLE public.restaurant_deals ADD COLUMN valid_to TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 2. Add columns to restaurant_pages for full PDF tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_pages' AND column_name = 'pdf_text_extracted') THEN
    ALTER TABLE public.restaurant_pages ADD COLUMN pdf_text_extracted TEXT;
  END IF;
END $$;

-- 3. Add google_place_id and facebook_url to restaurants
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'google_place_id') THEN
    ALTER TABLE public.restaurants ADD COLUMN google_place_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'facebook_url') THEN
    ALTER TABLE public.restaurants ADD COLUMN facebook_url TEXT;
  END IF;
  
  -- Add location/address fields for filtering
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'city') THEN
    ALTER TABLE public.restaurants ADD COLUMN city TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'is_lakefront') THEN
    ALTER TABLE public.restaurants ADD COLUMN is_lakefront BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Create fish_fry_history table for tracking changes
CREATE TABLE IF NOT EXISTS public.fish_fry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.restaurant_deals(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Snapshot of deal data at this point
  price TEXT,
  fish_type TEXT,
  all_you_can_eat BOOLEAN,
  sides TEXT,
  days TEXT[],
  
  -- Change metadata
  change_type TEXT NOT NULL, -- 'created', 'updated', 'verified', 'outdated'
  changed_by TEXT, -- 'scraper', 'user_submission', 'admin'
  
  -- Evidence
  evidence_url TEXT,
  evidence_snippet TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fish_fry_history
ALTER TABLE public.fish_fry_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for fish_fry_history
CREATE POLICY "Public can view fish fry history" 
  ON public.fish_fry_history 
  FOR SELECT 
  USING (true);

CREATE POLICY "System can insert fish fry history" 
  ON public.fish_fry_history 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Admins can manage fish fry history" 
  ON public.fish_fry_history 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'));

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_deal_type ON public.restaurant_deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_verification_status ON public.restaurant_deals(verification_status);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_days ON public.restaurant_deals USING GIN(days);
CREATE INDEX IF NOT EXISTS idx_restaurant_deals_fish_fry ON public.restaurant_deals(deal_type, verification_status) WHERE deal_type = 'fish_fry';
CREATE INDEX IF NOT EXISTS idx_restaurant_pages_type ON public.restaurant_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON public.restaurants(city);
CREATE INDEX IF NOT EXISTS idx_fish_fry_history_deal ON public.fish_fry_history(deal_id);

-- 6. Create function to track fish fry changes
CREATE OR REPLACE FUNCTION public.track_fish_fry_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track fish_fry deals
  IF NEW.deal_type = 'fish_fry' THEN
    -- Determine change type
    DECLARE
      change_type_val TEXT;
    BEGIN
      IF TG_OP = 'INSERT' THEN
        change_type_val := 'created';
      ELSIF OLD.verification_status != NEW.verification_status THEN
        IF NEW.verification_status = 'verified' THEN
          change_type_val := 'verified';
        ELSIF NEW.verification_status = 'outdated' THEN
          change_type_val := 'outdated';
        ELSE
          change_type_val := 'updated';
        END IF;
      ELSIF OLD.price IS DISTINCT FROM NEW.price 
         OR OLD.fish_type IS DISTINCT FROM NEW.fish_type
         OR OLD.all_you_can_eat IS DISTINCT FROM NEW.all_you_can_eat THEN
        change_type_val := 'updated';
      ELSE
        -- No significant change
        RETURN NEW;
      END IF;
      
      INSERT INTO public.fish_fry_history (
        deal_id, restaurant_id, price, fish_type, all_you_can_eat, 
        sides, days, change_type, changed_by, evidence_url, evidence_snippet
      ) VALUES (
        NEW.id, NEW.restaurant_id, NEW.price, NEW.fish_type, NEW.all_you_can_eat,
        NEW.sides, NEW.days, change_type_val, COALESCE(NEW.source_type, 'scraper'),
        NEW.evidence_url, NEW.evidence_snippet
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS track_fish_fry_trigger ON public.restaurant_deals;
CREATE TRIGGER track_fish_fry_trigger
  AFTER INSERT OR UPDATE ON public.restaurant_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.track_fish_fry_changes();