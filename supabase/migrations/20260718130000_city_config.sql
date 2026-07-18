-- city_config: single source of truth for every city-specific fact that was
-- previously hardcoded across edge functions (bboxes, keyword gazetteers, NWS
-- zones, agency URLs, branding). This is the template foundation: cloning the
-- product to a new city becomes "insert a row", not "find/replace 92 files".
--
-- Single-city deployments hold one row (id='default'). If the fleet later
-- moves to a multi-tenant database, this table gains a city_id and the loader
-- keys off hostname — the shape is forward-compatible.

CREATE TABLE IF NOT EXISTS public.city_config (
  id text PRIMARY KEY DEFAULT 'default',
  city_name text NOT NULL,
  state_code text NOT NULL,
  county_name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  -- {minLat, maxLat, minLon, maxLon}
  bbox jsonb NOT NULL,
  -- Positive gazetteer: any of these in title/location marks content local.
  local_keywords text[] NOT NULL DEFAULT '{}',
  -- Negative gazetteer: any of these marks content non-local (big nearby metros).
  non_local_keywords text[] NOT NULL DEFAULT '{}',
  nws_zones text[] NOT NULL DEFAULT '{}',
  state_511_api_base text,
  spotcrime_path text,
  sheriff_press_url text,
  utility_outage_url text,
  site_domain text NOT NULL,
  site_name text NOT NULL,
  from_email text NOT NULL,
  breaking_from_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.city_config ENABLE ROW LEVEL SECURITY;

-- Config is non-sensitive (all values already ship in the client bundle today);
-- public read lets the frontend adopt it incrementally.
DROP POLICY IF EXISTS "Public can read city config" ON public.city_config;
CREATE POLICY "Public can read city config" ON public.city_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage city config" ON public.city_config;
CREATE POLICY "Admins can manage city config" ON public.city_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed: Lake Geneva, WI (values consolidated from the previously-hardcoded
-- constants in ingest-incident, sync-511-traffic, sync-spotcrime-incidents,
-- sync-nws-alerts, and LiveIncidentsSidebar).
INSERT INTO public.city_config (
  id, city_name, state_code, county_name, timezone, latitude, longitude, bbox,
  local_keywords, non_local_keywords, nws_zones, state_511_api_base,
  spotcrime_path, sheriff_press_url, utility_outage_url,
  site_domain, site_name, from_email, breaking_from_email
) VALUES (
  'default',
  'Lake Geneva',
  'WI',
  'Walworth County',
  'America/Chicago',
  42.5917,
  -88.4334,
  '{"minLat": 42.4953, "maxLat": 42.8421, "minLon": -88.7773, "maxLon": -88.2891}'::jsonb,
  ARRAY[
    'lake geneva','geneva lake','walworth','williams bay','fontana','elkhorn',
    'delavan','genoa city','bloomfield','town of linn','lake como','como',
    'powers lake','darien','east troy','sharon','burlington','whitewater',
    'pell lake','twin lakes','lyons','abbey resort','grand geneva',
    'big foot beach','wrigley drive','hwy 50','hwy 12','highway 50','highway 12',
    'flat iron park','library park','horticultural hall','riviera','pier 290',
    'baker house','gordy','harpoon willie','fat cat','geneva tap house',
    'topsy turvy','house of music','crafted americana','chuck''s lakeshore','badger high',
    'us-12','highway 67','hwy 67','highway 120','hwy 120','i-43','interstate 43'
  ],
  ARRAY[
    'milwaukee','kenosha','racine','madison','waukesha','janesville','beloit',
    'chicago','rockford','green bay','brookfield','wauwatosa','minneapolis',
    'minnesota','illinois','indiana','iowa','michigan'
  ],
  ARRAY['WIZ063','WIZ062','WIZ057'],
  'https://511wi.gov/api',
  'WI/Walworth%20County',
  'https://www.co.walworth.wi.us/747/News-Releases',
  NULL,
  'lakegenevabrief.com',
  'Lake Geneva Brief',
  'newsletter@citybrief.info',
  'breaking@citybrief.info'
) ON CONFLICT (id) DO NOTHING;
