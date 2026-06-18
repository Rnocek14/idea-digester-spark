
-- Hyperlocal gate: require a real local place token before a story can carry
-- Tier 1/Tier 2 geo OR auto-publish. Catches the case where regional sources
-- (Fox6, TMJ4, Urban Milwaukee) inherit a default tier without the body
-- actually mentioning Lake Geneva / Walworth County.

CREATE OR REPLACE FUNCTION public.enforce_hyperlocal_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  haystack text;
  local_kw text[] := ARRAY[
    -- Tier 1 core
    'lake geneva','geneva lake','williams bay','fontana','big foot beach',
    'wrigley drive','flat iron park','library park','horticultural hall',
    'riviera','grand geneva','abbey resort','pier 290','baker house',
    'gordy','harpoon willie','fat cat','geneva tap house','topsy turvy',
    'house of music','crafted americana','chuck''s lakeshore','chucks lakeshore',
    'town of linn',' linn,',
    -- Tier 2 Walworth County
    'walworth','delavan','elkhorn','bloomfield','darien','east troy',
    'lake como','badger high','genoa city','sharon','twin lakes',
    'burlington','pell lake','lyons','whitewater'
  ];
  kw text;
  has_local boolean := false;
BEGIN
  -- Only gate when story claims to be hyperlocal (T1/T2)
  IF COALESCE(NEW.geo_tier, 0) NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  haystack := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,'') || ' ' || coalesce(NEW.content,''));

  FOREACH kw IN ARRAY local_kw LOOP
    IF position(kw IN haystack) > 0 THEN
      has_local := true;
      EXIT;
    END IF;
  END LOOP;

  IF has_local THEN
    RETURN NEW;
  END IF;

  -- No local keyword found → demote and hold
  NEW.geo_tier := 0;
  NEW.geo_label := NULL;

  IF NEW.status = 'auto_published' OR NEW.status = 'pending' THEN
    NEW.status := 'held';
    NEW.hold_reason := COALESCE(NEW.hold_reason, 'no_local_keyword');
    NEW.decision_path := COALESCE(NEW.decision_path,'') ||
      E'\nenforce_hyperlocal_gate: T' || COALESCE(NEW.geo_tier::text,'?') ||
      ' claimed but no local keyword found → demoted to T0 + held';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_hyperlocal_gate ON public.content_queue;
CREATE TRIGGER trg_enforce_hyperlocal_gate
BEFORE INSERT OR UPDATE OF status, geo_tier, title, summary, content
ON public.content_queue
FOR EACH ROW
EXECUTE FUNCTION public.enforce_hyperlocal_gate();

-- Backfill: move recent (last 7d) auto_published T1/T2 stories that fail the
-- local-keyword check back to pending, demoted to T0.
WITH local_kw AS (
  SELECT unnest(ARRAY[
    'lake geneva','geneva lake','williams bay','fontana','big foot beach',
    'wrigley drive','flat iron park','library park','horticultural hall',
    'riviera','grand geneva','abbey resort','pier 290','baker house',
    'gordy','harpoon willie','fat cat','geneva tap house','topsy turvy',
    'house of music','crafted americana','chuck''s lakeshore','chucks lakeshore',
    'town of linn',
    'walworth','delavan','elkhorn','bloomfield','darien','east troy',
    'lake como','badger high','genoa city','sharon','twin lakes',
    'burlington','pell lake','lyons','whitewater'
  ]) AS kw
),
candidates AS (
  SELECT cq.id,
         lower(coalesce(cq.title,'') || ' ' || coalesce(cq.summary,'') || ' ' || coalesce(cq.content,'')) AS hay
  FROM public.content_queue cq
  WHERE cq.created_at > now() - interval '7 days'
    AND cq.status = 'auto_published'
    AND cq.geo_tier IN (1, 2)
),
flagged AS (
  SELECT c.id
  FROM candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM local_kw lk WHERE position(lk.kw IN c.hay) > 0
  )
)
UPDATE public.content_queue cq
SET status = 'pending',
    geo_tier = 0,
    geo_label = NULL,
    hold_reason = 'no_local_keyword_backfill',
    decision_path = COALESCE(cq.decision_path,'') ||
      E'\nhyperlocal_backfill_2026_06_18: demoted from T1/T2 auto_published; no local keyword in title/summary/content'
FROM flagged
WHERE cq.id = flagged.id;
