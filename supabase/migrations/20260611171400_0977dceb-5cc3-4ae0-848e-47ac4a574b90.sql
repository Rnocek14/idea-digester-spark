
-- 1) history_entries — anchored daily content pool
CREATE TABLE public.history_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Day-of-year anchor: 1..366. Allows daily rotation regardless of original year.
  day_of_year smallint NOT NULL CHECK (day_of_year BETWEEN 1 AND 366),
  -- Optional: the actual historical date if known (year + date).
  event_year integer,
  event_date date,
  title text NOT NULL,
  body text NOT NULL,
  source_citation text,           -- "Geneva Lake Museum archives", book + page, etc.
  source_url text,
  image_url text,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  last_published_at timestamptz,
  publish_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX history_entries_day_of_year_idx ON public.history_entries(day_of_year, status);
CREATE INDEX history_entries_status_idx ON public.history_entries(status);

GRANT SELECT ON public.history_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.history_entries TO authenticated;
GRANT ALL ON public.history_entries TO service_role;

ALTER TABLE public.history_entries ENABLE ROW LEVEL SECURITY;

-- Public can read approved entries
CREATE POLICY "history_entries public read approved"
ON public.history_entries FOR SELECT
USING (status = 'approved');

-- Admins manage all
CREATE POLICY "history_entries admin full access"
ON public.history_entries FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER history_entries_updated_at
BEFORE UPDATE ON public.history_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Milwaukee-noise auto-hold trigger
-- On insert into content_queue: if Tier-0 from a regional TV source, require a
-- local geo keyword in title/content/summary. Else flip to 'held' with reason.
CREATE OR REPLACE FUNCTION public.auto_hold_out_of_geo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_name text;
  haystack text;
  is_regional_tv boolean;
  local_kw text[] := ARRAY[
    'lake geneva','walworth','williams bay','fontana','elkhorn','delavan',
    'genoa city','bloomfield','linn','sharon','east troy','whitewater',
    'burlington','geneva lake','lake como','powers lake'
  ];
  kw text;
  found boolean := false;
BEGIN
  -- Only consider rows that are about to enter the queue as pending
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  -- Only Tier-0 (regional/state) candidates are gated
  IF COALESCE(NEW.geo_tier, 1) <> 0 THEN
    RETURN NEW;
  END IF;

  SELECT lower(name) INTO src_name FROM public.sources WHERE id = NEW.source_id;
  is_regional_tv := src_name IS NOT NULL AND (
    src_name LIKE '%fox6%' OR src_name LIKE '%tmj4%' OR
    src_name LIKE '%cbs 58%' OR src_name LIKE '%wisn%' OR
    src_name LIKE '%spectrum%' OR src_name LIKE '%urban milwaukee%'
  );
  IF NOT is_regional_tv THEN
    RETURN NEW;
  END IF;

  haystack := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,'') || ' ' || coalesce(NEW.content,''));
  FOREACH kw IN ARRAY local_kw LOOP
    IF position(kw IN haystack) > 0 THEN
      found := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT found THEN
    NEW.status := 'held';
    NEW.hold_reason := 'out_of_geo';
    NEW.decision_path := coalesce(NEW.decision_path,'') || E'\nauto_hold_out_of_geo: tier-0 regional TV with no local geo keyword';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER content_queue_auto_hold_out_of_geo
BEFORE INSERT ON public.content_queue
FOR EACH ROW EXECUTE FUNCTION public.auto_hold_out_of_geo();
