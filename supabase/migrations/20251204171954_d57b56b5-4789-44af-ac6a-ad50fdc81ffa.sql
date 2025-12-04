-- Add notes column to engagement_opportunities for tagging context
ALTER TABLE public.engagement_opportunities 
ADD COLUMN notes text;