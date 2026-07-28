-- Multi-city phase 2: city_id on content tables.
--
-- Every row defaults to 'default' (Lake Geneva), so this is a zero-behavior
-- change for the live site. It makes it POSSIBLE for a second city's content
-- to coexist without leaking into the first city's surfaces — the precondition
-- for activating any bootstrapped city (see docs/city-bootstrap-sop.md §5).
--
-- Frontend/serving queries adopt .eq('city_id', ...) in phase 3 (hostname
-- routing). Until then a single live city means unfiltered queries stay
-- correct because everything IS 'default'.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_queue',
    'incidents',
    'daily_briefs',
    'newsletters',
    'lake_beats',
    'job_listings',
    'business_profiles',
    'evergreen_content',
    'history_entries',
    'community_posts',
    'community_submissions',
    'restaurants',
    'restaurant_news',
    'sponsors',
    'ad_placements'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS city_id text NOT NULL DEFAULT ''default'' REFERENCES public.city_config(id)',
      t
    );
  END LOOP;
END $$;

-- Hot-path composite indexes (the two tables queried on every page load).
CREATE INDEX IF NOT EXISTS idx_content_queue_city_status_publish
  ON public.content_queue (city_id, status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_city_status_updated
  ON public.incidents (city_id, status, updated_at DESC);

-- subscribers.city_id already exists as nullable text with "NULL means Lake
-- Geneva" semantics. Normalize to the registry convention. No FK: historic
-- free-text values may exist and subscriber writes must never fail on a
-- config mismatch — reconcile via reporting instead.
UPDATE public.subscribers SET city_id = 'default' WHERE city_id IS NULL;
ALTER TABLE public.subscribers ALTER COLUMN city_id SET DEFAULT 'default';
