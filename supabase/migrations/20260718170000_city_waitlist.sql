-- city_waitlist: demand capture for cities we haven't launched yet.
-- When the city finder (geolocation / zip) can't match a visitor to a live
-- city, they can leave an email + zip. Each row is a market signal: the
-- expansion roadmap is "sort waitlist by zip cluster, launch where demand is."

CREATE TABLE IF NOT EXISTS public.city_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  zip text,
  lat double precision,
  lon double precision,
  place_label text,
  nearest_city_id text,
  distance_km double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One signup per email+zip; repeat submissions are silent no-ops client-side.
CREATE UNIQUE INDEX IF NOT EXISTS uq_city_waitlist_email_zip
  ON public.city_waitlist (lower(email), COALESCE(zip, ''));

ALTER TABLE public.city_waitlist ENABLE ROW LEVEL SECURITY;

-- Same pattern as subscribers: the public can sign up, only admins can read.
DROP POLICY IF EXISTS "Anyone can join the city waitlist" ON public.city_waitlist;
CREATE POLICY "Anyone can join the city waitlist" ON public.city_waitlist
  FOR INSERT WITH CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255
  );

DROP POLICY IF EXISTS "Admins can view the city waitlist" ON public.city_waitlist;
CREATE POLICY "Admins can view the city waitlist" ON public.city_waitlist
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
