-- Fill the empty middle of the passport ladder, without inventing geography.
--
-- THE PROBLEM
-- A walker at 6 of 16 stops has ten stops and no milestone in between. Leg
-- badges were meant to cover that gap and cannot yet: assigning stops to the
-- seven official legs needs the Williams Bay Rec Dept map, which is not
-- reachable from here, and — more fundamentally — a single leg_order_index
-- cannot express the truth that an access-point stop belongs to TWO legs at
-- once. Williams Bay is the end of leg 7 and the start of leg 1. Every
-- single-integer assignment therefore produces either false positives (leg 2's
-- stops all sit clustered at Fontana, so you would earn it without walking the
-- 2.3 miles to Shadow Lane) or false negatives. A badge is a claim about where
-- somebody walked; it should not rest on that.
--
-- THE FIX
-- Group by shore instead, using `community` — a field already in the data,
-- already accurate, and requiring no map. Four stretches with a real spread of
-- stops each, and a walker can see "all of Lake Geneva, one of Fontana" long
-- before the loop closes. The leg scaffolding stays exactly as it is, dormant,
-- ready for the map whenever it arrives.
--
-- One correction so the grouping tells the truth: Black Point is seeded as Lake
-- Geneva (its mailing address) but stands on a promontory on the SOUTH shore in
-- the Town of Linn. Grouped under Lake Geneva it would put a south-shore stop in
-- the east-end cluster and misdescribe where a walker had actually been.
UPDATE public.shore_path_stops
   SET community = 'Linn'
 WHERE slug = 'black-point-estate'
   AND community IS DISTINCT FROM 'Linn';

-- Resulting distribution — the ladder itself:
--   Lake Geneva   5   Library Park, Flat Iron, the Riviera, the beach, Maple Lawn
--   Linn          3   Black Point, the south shore stretch, Linn Pier
--   Fontana       3   Fontana Beach, Reid Park, Abbey Harbor
--   Williams Bay  5   Kishwauketoe, Edgewater, the village beach, Yerkes, Cedar Point
DO $$
DECLARE
  v_counts text;
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.shore_path_stops
   WHERE is_published = true AND (community IS NULL OR btrim(community) = '');
  IF v_missing > 0 THEN
    -- A stop with no community would silently vanish from the ladder, which is
    -- worse than an obvious failure here.
    RAISE EXCEPTION '% published stop(s) have no community and would be excluded from shore progress', v_missing;
  END IF;

  SELECT string_agg(community || '=' || n, ', ' ORDER BY community) INTO v_counts
    FROM (
      SELECT community, count(*) AS n
        FROM public.shore_path_stops
       WHERE is_published = true
       GROUP BY community
    ) s;
  RAISE NOTICE 'shore progress groups: %', v_counts;
END $$;

CREATE INDEX IF NOT EXISTS idx_shore_path_stops_community
  ON public.shore_path_stops (community)
  WHERE is_published = true;
