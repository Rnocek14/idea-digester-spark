-- Add merged_into_id for tracking merges
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.business_profiles(id);

-- Index for finding merged records
CREATE INDEX IF NOT EXISTS idx_business_profiles_merged_into 
ON public.business_profiles(merged_into_id) WHERE merged_into_id IS NOT NULL;