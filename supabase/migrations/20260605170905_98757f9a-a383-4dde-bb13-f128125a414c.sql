
-- 1. Shore Path stops table
CREATE TABLE public.shore_path_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_index INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_label TEXT,
  community TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  map_x_pct NUMERIC,
  map_y_pct NUMERIC,
  approx_mile NUMERIC,
  description TEXT,
  look_for TEXT,
  hero_image_url TEXT,
  is_public_landmark BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_index)
);

GRANT SELECT ON public.shore_path_stops TO anon;
GRANT SELECT ON public.shore_path_stops TO authenticated;
GRANT ALL ON public.shore_path_stops TO service_role;

ALTER TABLE public.shore_path_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published shore path stops"
  ON public.shore_path_stops FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage shore path stops"
  ON public.shore_path_stops FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_shore_path_stops_updated_at
  BEFORE UPDATE ON public.shore_path_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link Local Love submissions to a stop
ALTER TABLE public.community_submissions
  ADD COLUMN IF NOT EXISTS shore_path_stop_id UUID REFERENCES public.shore_path_stops(id) ON DELETE SET NULL;

-- 3. Seed verified public-access stops only.
-- Conservative copy: no owner names for private estates, no "peek inside"
-- language, no encouragement of trespass. Editorial can refine in-DB.
INSERT INTO public.shore_path_stops
  (order_index, slug, name, short_label, community, latitude, longitude, map_x_pct, map_y_pct, approx_mile, description, look_for)
VALUES
  (1, 'library-park', 'Library Park', 'Library Park', 'Lake Geneva',
    42.5915, -88.4334, 78, 42, 0.0,
    'The most common starting point for the Shore Path. A public park beside the Lake Geneva Public Library with benches, shoreline access, and a clear view across the lake.',
    'The path heads west from here along the public shoreline easement that has been continuous since the 1870s.'),
  (2, 'flat-iron-park', 'Flat Iron Park', 'Flat Iron', 'Lake Geneva',
    42.5921, -88.4361, 75, 40, 0.4,
    'A small downtown park where the Riviera Ballroom anchors the lakefront. Summer concerts and the seasonal farmers market happen here.',
    'The Riviera building''s second-story ballroom is one of the most photographed buildings on the lake.'),
  (3, 'riviera-beach', 'Riviera Beach & Pier', 'Riviera', 'Lake Geneva',
    42.5926, -88.4378, 72, 39, 0.6,
    'Lake Geneva''s downtown public beach. Tour boats depart from the adjacent pier in season.',
    'Lake Geneva Cruise Line boats loading at the pier — a good place to look out over the broadest stretch of the lake.'),
  (4, 'lake-geneva-public-beach', 'Lake Geneva Public Beach', 'Public Beach', 'Lake Geneva',
    42.5934, -88.4395, 70, 38, 0.9,
    'A wider sandy beach with lifeguards in season. Day-use fee in summer for non-residents.',
    'Sailboats moored just offshore in summer.'),
  (5, 'maple-lawn-area', 'Maple Lawn Walking Section', 'Maple Lawn', 'Lake Geneva',
    42.5950, -88.4445, 65, 36, 1.6,
    'A stretch where the path narrows and the shoreline becomes quieter. You are walking on a public easement that runs in front of long-standing lakefront properties — stay on the path and keep voices down.',
    'The change in landscaping styles as you move past different stretches of the shoreline.'),
  (6, 'black-point-estate', 'Black Point Estate', 'Black Point', 'Lake Geneva',
    42.5780, -88.4810, 50, 65, 5.5,
    'A Wisconsin Historical Society site. Black Point is one of the few Gilded Age lakefront homes open to the public, by guided tour arrival via the Lake Geneva Cruise Line.',
    'The 1888 Queen Anne tower visible from the lake. Tours are ticketed through the Wisconsin Historical Society.'),
  (7, 'south-shore-club-area', 'South Shore Path Stretch', 'South Shore', 'Linn',
    42.5640, -88.4900, 48, 78, 8.5,
    'The southern shoreline. Longer between public access points than the north shore, so plan water and turnaround accordingly.',
    'Quieter foot traffic. The path here gives some of the best open views back across the lake toward Lake Geneva.'),
  (8, 'linn-pier', 'Linn Pier Public Access', 'Linn Pier', 'Linn',
    42.5560, -88.5350, 35, 80, 10.5,
    'A public access point on the south shore with a small parking area. A good waypoint for an out-and-back walk if you''re not doing the full 21 miles.',
    'The pier is a working public boat launch — give boaters room.'),
  (9, 'fontana-beach', 'Fontana Beach', 'Fontana Beach', 'Fontana',
    42.5470, -88.5710, 22, 70, 13.0,
    'Fontana''s public swimming beach at the western tip of the lake. Restrooms, picnic area, and a long stretch of sand.',
    'This is the western end of the lake — the view east is the longest unbroken sightline you''ll get.'),
  (10, 'reid-park', 'Reid Park', 'Reid Park', 'Fontana',
    42.5485, -88.5685, 24, 65, 13.4,
    'A small lakefront park in downtown Fontana adjacent to the public beach. Benches and shade.',
    'The Abbey Resort''s harbor across the way — one of the largest inland marinas in the Midwest.'),
  (11, 'abbey-harbor-view', 'Abbey Harbor View', 'Abbey Harbor', 'Fontana',
    42.5500, -88.5630, 28, 60, 13.9,
    'The path skirts the public sidewalk past The Abbey Resort''s harbor area. Stay on marked walkways.',
    'The mix of sailboats and powerboats moored in the harbor — a good photo angle in morning light.'),
  (12, 'kishwauketoe-edge', 'Kishwauketoe Nature Conservancy Edge', 'Kishwauketoe', 'Williams Bay',
    42.5740, -88.5440, 38, 50, 15.5,
    'A 230-acre publicly accessible nature preserve adjacent to the Shore Path. Worth a side loop if you have time.',
    'Native prairie plantings and restored wetlands. Bird activity is strong here in spring and fall.'),
  (13, 'edgewater-park', 'Edgewater Park', 'Edgewater', 'Williams Bay',
    42.5775, -88.5395, 42, 47, 16.3,
    'A small lakefront park in Williams Bay with shade and benches. A natural rest stop.',
    'The view east toward Conference Point.'),
  (14, 'williams-bay-lakefront', 'Williams Bay Lakefront Park', 'Lakefront Park', 'Williams Bay',
    42.5790, -88.5380, 44, 46, 16.6,
    'Williams Bay''s main public beach and lakefront park. Pier, swimming area, and grass for picnicking.',
    'Sailing classes and the village concert series happen here in summer.'),
  (15, 'yerkes-area', 'Yerkes Observatory Area', 'Yerkes', 'Williams Bay',
    42.5705, -88.5560, 33, 55, 17.5,
    'The 1897 observatory sits a short walk uphill from the lake. Recently reopened for public tours through the Yerkes Future Foundation.',
    'The dome of the Great Refractor — historically the largest refracting telescope in the world.'),
  (16, 'cedar-point-park', 'Cedar Point Park', 'Cedar Point', 'Williams Bay',
    42.5820, -88.5260, 50, 44, 18.5,
    'A wooded public park on the north shore. Quieter than the village beaches.',
    'The path continues east from here back toward Lake Geneva — the final stretch follows the north shoreline.');
