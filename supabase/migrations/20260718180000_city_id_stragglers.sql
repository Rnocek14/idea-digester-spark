-- Straggler tables from the phase-2 city_id rollout.
ALTER TABLE public.business_stories
  ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id);
ALTER TABLE public.restaurant_deals
  ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT 'default' REFERENCES public.city_config(id);
