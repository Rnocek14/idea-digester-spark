-- Add metadata fields for import tracking
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS import_source text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS external_payload jsonb,
ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Index for sync queries
CREATE INDEX IF NOT EXISTS idx_business_profiles_import_source 
ON public.business_profiles(import_source);

CREATE INDEX IF NOT EXISTS idx_business_profiles_last_synced 
ON public.business_profiles(last_synced_at);