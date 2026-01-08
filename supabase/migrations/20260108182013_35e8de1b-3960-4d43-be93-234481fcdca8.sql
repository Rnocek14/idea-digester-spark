-- Add deal_hash for stable upserts + tracking columns
ALTER TABLE public.restaurant_deals 
ADD COLUMN IF NOT EXISTS deal_hash text,
ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS valid_to timestamp with time zone,
ADD COLUMN IF NOT EXISTS start_minutes int,
ADD COLUMN IF NOT EXISTS end_minutes int;

-- Create unique index on deal_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_deals_hash 
ON public.restaurant_deals(deal_hash) 
WHERE deal_hash IS NOT NULL;

-- Add PDF tracking columns to restaurant_pages
ALTER TABLE public.restaurant_pages
ADD COLUMN IF NOT EXISTS pdf_extraction_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pdf_extraction_chars int DEFAULT 0;