-- Sourcing and historical imagery for Shore Path stops.
--
-- Why: the Shore Path already has a paid GPS audio tour with 146 stops and two
-- printed guides sold locally. Competing on volume of history is a fight this
-- desk loses. What none of them do is say where a claim came from — and that is
-- both the thing we can win on and the thing the /about transparency policy
-- already commits us to.
--
-- The guide page currently handles this in hand-written prose for one claim: it
-- says the 1870s easement date is "the account as it is handed down around the
-- lake" and that the desk "has not reproduced a deed, plat, or court record
-- here." That instinct is right, and it should be structural rather than a
-- one-off paragraph, so every stop can carry it.

-- ---------------------------------------------------------------------------
-- 1. Where each stop's facts came from
-- ---------------------------------------------------------------------------
-- Array of {url, publisher, supports} objects. Rendered on the stop page as a
-- plain sources list. An empty array is honest — it means nobody has sourced
-- this stop yet, and the UI says so rather than implying authority.
ALTER TABLE public.shore_path_stops
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;

-- How firmly the history is established:
--   documented  — a citable published source states it
--   traditional — widely repeated locally, no primary record reproduced here
--   thin        — little found; the entry is deliberately short
-- 'traditional' is not a euphemism for "made up": it is the honest label for
-- the lake's oral history, which is genuinely valuable and genuinely unverified.
ALTER TABLE public.shore_path_stops
  ADD COLUMN IF NOT EXISTS history_confidence text
    CHECK (history_confidence IS NULL OR history_confidence IN ('documented', 'traditional', 'thin'));

COMMENT ON COLUMN public.shore_path_stops.sources IS
  'Array of {url, publisher, supports}. Displayed publicly. Empty means unsourced, and the page says so.';
COMMENT ON COLUMN public.shore_path_stops.history_confidence IS
  'documented | traditional | thin. Marks whether story_long rests on a citable record or on local oral history.';

-- ---------------------------------------------------------------------------
-- 2. Then-and-now imagery
-- ---------------------------------------------------------------------------
-- The single biggest perceived-quality gain available, and structurally
-- unavailable to an audio tour or a printed guide: the same view a century
-- earlier, beside the one the walker is looking at.
--
-- Credit and rights are separate columns rather than baked into the caption
-- because archives that hold public-domain photographs frequently assert rights
-- over their own scans. Whoever loads an image has to record what the archive
-- actually permits, not assume age means free.
ALTER TABLE public.shore_path_stops
  ADD COLUMN IF NOT EXISTS historical_image_url text,
  ADD COLUMN IF NOT EXISTS historical_image_year text,
  ADD COLUMN IF NOT EXISTS historical_image_credit text,
  ADD COLUMN IF NOT EXISTS historical_image_source_url text,
  ADD COLUMN IF NOT EXISTS historical_image_rights text
    CHECK (historical_image_rights IS NULL OR historical_image_rights IN
      ('public_domain', 'no_known_restrictions', 'licensed', 'permission_granted'));

COMMENT ON COLUMN public.shore_path_stops.historical_image_rights IS
  'Recorded per image. public_domain and no_known_restrictions are NOT the same claim — archives often assert rights over scans of public-domain originals. Nothing publishes without this set.';

-- Only surface a historical image once its provenance is recorded. This is the
-- gate: an image with no credit and no rights status must not reach a reader,
-- because a wrong photo credit in a local paper is a correction at best.
CREATE INDEX IF NOT EXISTS idx_shore_path_stops_has_historical_image
  ON public.shore_path_stops (id)
  WHERE historical_image_url IS NOT NULL
    AND historical_image_credit IS NOT NULL
    AND historical_image_rights IS NOT NULL;
