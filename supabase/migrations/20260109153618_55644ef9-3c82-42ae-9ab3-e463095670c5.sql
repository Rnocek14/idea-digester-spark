-- Add feature-grade content fields to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS local_reputation TEXT,
ADD COLUMN IF NOT EXISTS distinguishing_feature TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.restaurants.local_reputation IS 'Short descriptor of what locals know this place for';
COMMENT ON COLUMN public.restaurants.distinguishing_feature IS 'What makes this restaurant different from others';