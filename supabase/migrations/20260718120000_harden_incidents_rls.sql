-- Harden incidents RLS.
-- 1) Drop the open INSERT policies: anyone with the anon key could insert rows
--    directly into the public live-incidents feed. Community quick reports now go
--    through the rate-limited `report-incident` edge function (service role), and
--    all pipeline functions already use the service role, which bypasses RLS.
DROP POLICY IF EXISTS "System can insert incidents" ON public.incidents;
DROP POLICY IF EXISTS "System can insert incident updates" ON public.incident_updates;

-- 2) Include 'developing' in the public read policy. The incidents queue publishes
--    to this status and LiveIncidentsSidebar queries it, but anon readers could not
--    see it — a "developing" incident was invisible to the public.
DROP POLICY IF EXISTS "Public can view active incidents" ON public.incidents;
CREATE POLICY "Public can view active incidents" ON public.incidents
  FOR SELECT USING (status IN ('active', 'developing', 'monitoring', 'resolved'));
