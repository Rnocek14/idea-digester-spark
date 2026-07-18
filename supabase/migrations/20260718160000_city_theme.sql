-- Per-city theme/identity. Config values make a city site FUNCTION; the theme
-- makes it feel like ITS place — Lake Geneva works because of the lake palette,
-- the wave line, the Shore Path motif, Streblow boats. Every city gets the same
-- slots, filled with its own identity. Anything not set falls back to the Lake
-- Geneva defaults in src/lib/cityTheme.ts, so first paint never flashes.
--
-- Schema (all optional):
--   tagline        masthead kicker ("Local Edition")
--   region_line    top-strip geography line
--   footer_kicker  footer motto ("From the Shore Path")
--   editor_note    signed footer note
--   motif          'lake' | 'river' | 'coast' | 'downtown' | 'none'
--                  (controls the animated water line + signature art slots)
--   palette        CSS custom-property values (HSL triplets) for the accent
--                  tokens in src/index.css: lake-light, lake-blue, lake-deep,
--                  lake-navy, shore-terracotta, lake-sand
--   signature      { feature_name, landmarks[] } — the hand-crafted local
--                  hooks (Shore Path / Streblow-class content) that guides and
--                  editorial features build on

ALTER TABLE public.city_config
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.city_config
SET theme = '{
  "tagline": "Local Edition",
  "region_line": "Geneva Lake · Walworth County, Wisconsin",
  "footer_kicker": "From the Shore Path",
  "editor_note": "Curated from the shore path by Gina Nocek — a daily note for the people who call Geneva Lake home.",
  "motif": "lake",
  "palette": {
    "lake-light": "200 80% 82%",
    "lake-blue": "205 65% 68%",
    "lake-deep": "205 55% 38%",
    "lake-navy": "215 70% 35%",
    "shore-terracotta": "25 75% 42%",
    "lake-sand": "45 30% 96%"
  },
  "signature": {
    "feature_name": "Shore Path",
    "landmarks": ["Yerkes Observatory", "Big Foot Beach", "Riviera Pier", "Streblow boats"]
  }
}'::jsonb
WHERE id = 'default' AND theme = '{}'::jsonb;
