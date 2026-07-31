-- News-freshness pipeline repair. The public feed filters on THREE columns
-- (status, safety_level, publish_date) but the webhook ingestion path
-- (ingest-news / ingest-civic) inserted rows that failed all three:
--
--   * status stayed 'pending' forever — nothing automated ever approved these
--     rows, and bulk-approve-content skips them anyway because…
--   * safety_level was NULL (column has no default), which fails both the
--     feed's IN ('safe','soft_sensitive') filter and bulk-approve eligibility;
--   * publish_date was NULL whenever the scraper couldn't extract an original
--     publish time, which fails the feed's date-window filters.
--
-- Net effect: every paper-of-record article ingested since the n8n removal
-- was invisible on the site, even after manual approval. The edge functions
-- are fixed alongside this migration; this file repairs the stored rows and
-- adds a belt-and-suspenders trigger so publish_date can never be NULL again.

-- 1) publish_date must never be NULL: default it to ingestion time on insert,
--    whatever the insert path.
CREATE OR REPLACE FUNCTION public.content_queue_default_publish_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.publish_date IS NULL THEN
    NEW.publish_date := COALESCE(NEW.created_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_content_queue_default_publish_date ON public.content_queue;
CREATE TRIGGER trg_content_queue_default_publish_date
  BEFORE INSERT ON public.content_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.content_queue_default_publish_date();

-- 2) Backfill existing NULL publish_date rows from ingestion time.
UPDATE public.content_queue
SET publish_date = created_at
WHERE publish_date IS NULL;

-- 3) Classify rows with NULL safety_level via the same keyword screen the
--    fixed ingest-news now applies: crime/courts, death/tragedy, and charged
--    topics are 'sensitive' (stay held for review); everything else is 'safe'.
--    Tagged 'keyword_screen' so step 4 (and future audits) can identify them.
UPDATE public.content_queue
SET
  safety_level = CASE
    WHEN (title || ' ' || COALESCE(summary, '') || ' ' || LEFT(COALESCE(content, ''), 2000)) ~* '\y(arrest|arrested|police|sheriff|crime|criminal|charged|charges|sentenced|guilty|lawsuit|court|jail|prison|theft|burglary|robbery|assault|battery|shooting|shot|stabbed|stabbing|homicide|murder|drugs|overdose|dui|owi|dies|died|death|dead|fatal|fatality|killed|obituary|suicide|drowned|drowning|crash|collision|missing person|protest|election|campaign|layoff|layoffs|outbreak|abuse|scandal|fraud)\y'
    THEN 'sensitive'
    ELSE 'safe'
  END,
  safety_tags = COALESCE(safety_tags, '[]'::jsonb) || '["keyword_screen"]'::jsonb,
  safety_reason = 'Backfill: keyword screen (safety_level was NULL, invisible to feed and bulk approval)'
WHERE safety_level IS NULL;

-- 4) Unstick the recent backlog: hyperlocal keyword-screened-safe rows that
--    were stranded in 'pending' auto-publish, matching the decision the fixed
--    ingest-news would have made at insert time. Limited to the feed's own
--    14-day window so nothing stale resurfaces.
UPDATE public.content_queue
SET
  status = 'auto_published',
  decision_path = 'freshness_backfill_auto',
  hold_reason = NULL
WHERE status = 'pending'
  AND safety_level = 'safe'
  AND safety_tags @> '["keyword_screen"]'::jsonb
  AND geo_tier >= 1
  AND created_at >= now() - interval '14 days';
