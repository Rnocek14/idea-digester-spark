-- Add resolved_at and resolution_reason columns to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_reason TEXT;