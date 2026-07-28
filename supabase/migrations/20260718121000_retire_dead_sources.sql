-- Retire confirmed-dead sources so they stop wasting fetch budget and polluting
-- Source Health (per .lovable/plan.md). Uses status='inactive' (the established
-- status value) plus a metadata marker, and only touches rows that are currently
-- active or error so nothing already-disabled is resurrected.

-- 1) Long-term zero-run sources: Fontana Village Alerts (1,582 zero runs),
--    Google News – Walworth County (dup of Walworth County Community News),
--    TMJ4 Walworth County (feed empty upstream), Spectrum News Wisconsin - Weather
--    (2,021 zero runs).
UPDATE public.sources
SET status = 'inactive',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'retired', true,
      'retired_reason', 'confirmed dead upstream / persistent zero-item runs',
      'retired_at', '2026-07-18'
    )
WHERE status IN ('active', 'error')
  AND (
    name = 'Fontana Village Alerts'
    OR name ILIKE 'Google News%Walworth%'
    OR name = 'TMJ4 Walworth County'
    OR name = 'Spectrum News Wisconsin - Weather'
  );

-- 2) City of Lake Geneva Police/Fire legacy CivicEngage RSS endpoints
--    (RSSFeed.aspx pattern, erroring since 2026-06-08). Matched by URL so all
--    name variants are covered.
UPDATE public.sources
SET status = 'inactive',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'retired', true,
      'retired_reason', 'legacy CivicEngage RSSFeed.aspx endpoint dead since 2026-06-08',
      'retired_at', '2026-07-18'
    )
WHERE status IN ('active', 'error')
  AND url ILIKE '%cityoflakegeneva.gov/RSSFeed.aspx%';
