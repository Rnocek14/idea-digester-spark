
ALTER TABLE public.shore_path_stops
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 140,
  ADD COLUMN IF NOT EXISTS story_long text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_sec integer,
  ADD COLUMN IF NOT EXISTS audio_transcript text,
  ADD COLUMN IF NOT EXISTS audio_voice_id text;
