-- Step 1: Add canonical fields to business_profiles
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS google_place_id text UNIQUE,
ADD COLUMN IF NOT EXISTS geo_tier smallint DEFAULT 1,
ADD COLUMN IF NOT EXISTS source_confidence text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS normalized_name text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS categories text[];

-- Add constraint for source_confidence
ALTER TABLE public.business_profiles
ADD CONSTRAINT business_profiles_source_confidence_check 
CHECK (source_confidence IN ('low', 'medium', 'high'));

-- Add constraint for geo_tier (1 = core, 2 = adjacent)
ALTER TABLE public.business_profiles
ADD CONSTRAINT business_profiles_geo_tier_check 
CHECK (geo_tier IN (1, 2));

-- Step 2: Add FK from restaurants to business_profiles
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS business_profile_id uuid REFERENCES public.business_profiles(id);

-- Step 3: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_business_profiles_geo_tier_type 
ON public.business_profiles(geo_tier, business_type);

CREATE INDEX IF NOT EXISTS idx_business_profiles_google_place_id 
ON public.business_profiles(google_place_id) WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_profiles_normalized_name 
ON public.business_profiles(normalized_name);

CREATE INDEX IF NOT EXISTS idx_restaurants_business_profile_id 
ON public.restaurants(business_profile_id);

-- Step 4: Create function to generate normalized_name on insert/update
CREATE OR REPLACE FUNCTION public.normalize_business_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]', '', 'g'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for auto-generating normalized_name
DROP TRIGGER IF EXISTS trigger_normalize_business_name ON public.business_profiles;
CREATE TRIGGER trigger_normalize_business_name
BEFORE INSERT OR UPDATE OF name ON public.business_profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_business_name();

-- Step 5: Backfill normalized_name for existing records
UPDATE public.business_profiles
SET normalized_name = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
WHERE normalized_name IS NULL;