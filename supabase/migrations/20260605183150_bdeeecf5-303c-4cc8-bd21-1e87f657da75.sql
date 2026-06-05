
UPDATE public.shore_path_stops SET latitude = lat, longitude = lng WHERE lat IS NOT NULL;
ALTER TABLE public.shore_path_stops DROP COLUMN IF EXISTS lat;
ALTER TABLE public.shore_path_stops DROP COLUMN IF EXISTS lng;
