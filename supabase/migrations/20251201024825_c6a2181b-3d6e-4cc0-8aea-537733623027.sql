-- Add segmentation and tracking fields to subscribers table

-- Add tags column for segmentation
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add engagement score (calculated from opens/clicks)
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

-- Add last_opened_at for tracking
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE;

-- Add last_clicked_at for tracking
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMP WITH TIME ZONE;

-- Add source field to track where subscriber came from
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create index for tags (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_subscribers_tags ON public.subscribers USING GIN(tags);

-- Create index for engagement score
CREATE INDEX IF NOT EXISTS idx_subscribers_engagement_score ON public.subscribers(engagement_score DESC);

-- Create index for source
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON public.subscribers(source);