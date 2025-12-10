-- Add external_id column for incident deduplication
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS external_id text;

-- Add source column to track where incidents came from
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'backfill';

-- Add sub_type for more granular incident classification
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS sub_type text;

-- Create unique index for dedupe (source + external_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_source_external_id 
ON public.incidents (source, external_id) 
WHERE external_id IS NOT NULL;