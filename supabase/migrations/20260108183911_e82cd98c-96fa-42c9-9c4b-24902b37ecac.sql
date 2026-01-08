-- Fix activity_log entity_type constraint with ALL existing types
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entity_type_check 
  CHECK (entity_type = ANY (ARRAY[
    'story'::text, 'newsletter'::text, 'subscriber'::text, 'source'::text, 
    'sponsor'::text, 'job'::text, 'incident'::text, 'business'::text, 
    'post'::text, 'lead'::text, 'restaurant'::text, 'deal'::text,
    'content'::text, 'system'::text
  ]));

-- Ensure restaurant_pages has unique constraint on restaurant_id,url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'restaurant_pages' 
    AND indexname = 'idx_restaurant_pages_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_restaurant_pages_unique ON public.restaurant_pages(restaurant_id, url);
  END IF;
END $$;