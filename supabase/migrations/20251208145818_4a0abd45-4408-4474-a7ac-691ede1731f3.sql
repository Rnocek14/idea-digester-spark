-- Backfill recurring_days for known recurring venues based on their patterns
-- This ensures events without event_date show on correct days only

-- Topsy Turvy - Sunday afternoon live music
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["sunday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND (
    title ILIKE '%topsy turvy%'
    OR title ILIKE '%at topsy turvy%'
  );

-- The Lookout Bar - Saturday night live music
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["saturday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND (
    title ILIKE '%lookout%'
    OR title ILIKE '%the lookout bar%'
  );

-- Music Mondays at The Getaway
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["monday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND title ILIKE '%music monday%';

-- Thursday nights at Geneva Tap House
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["thursday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND title ILIKE '%geneva tap house%'
  AND title ILIKE '%thursday%';

-- Friday nights at PIER 290
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["friday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND title ILIKE '%pier 290%'
  AND title ILIKE '%friday%';

-- Saturday nights at PIER 290
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["saturday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND title ILIKE '%pier 290%'
  AND title ILIKE '%saturday%';

-- Karaoke at The Cat - multiple nights (typically Wed/Fri/Sat)
UPDATE public.content_queue
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{recurring_days}',
  '["wednesday", "friday", "saturday"]'::jsonb
)
WHERE 
  category = 'events'
  AND event_date IS NULL
  AND (metadata IS NULL OR NOT metadata ? 'recurring_days' OR metadata->>'recurring_days' IS NULL)
  AND title ILIKE '%karaoke%the cat%';