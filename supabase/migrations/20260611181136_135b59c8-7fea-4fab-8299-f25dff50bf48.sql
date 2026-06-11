
CREATE TABLE public.story_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  pillar text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  slug text,
  event_type text NOT NULL CHECK (event_type IN ('homepage_impression','homepage_click','detail_view','newsletter_click','detail_read_complete')),
  session_id text,
  user_id uuid,
  path text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX story_events_pillar_occurred_idx ON public.story_events (pillar, occurred_at DESC);
CREATE INDEX story_events_session_occurred_idx ON public.story_events (session_id, occurred_at DESC);
CREATE INDEX story_events_entity_idx ON public.story_events (entity_type, entity_id);
CREATE INDEX story_events_event_type_idx ON public.story_events (event_type, occurred_at DESC);

GRANT INSERT ON public.story_events TO anon, authenticated;
GRANT SELECT ON public.story_events TO authenticated;
GRANT ALL ON public.story_events TO service_role;

ALTER TABLE public.story_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log story events"
  ON public.story_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read story events"
  ON public.story_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Aggregated metrics view used by the analytics dashboard
CREATE OR REPLACE VIEW public.content_pillar_metrics_7d AS
SELECT
  pillar,
  COUNT(*) FILTER (WHERE event_type = 'homepage_impression') AS impressions,
  COUNT(*) FILTER (WHERE event_type = 'homepage_click')      AS homepage_clicks,
  COUNT(*) FILTER (WHERE event_type = 'detail_view')         AS detail_views,
  COUNT(*) FILTER (WHERE event_type = 'newsletter_click')    AS newsletter_clicks,
  COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_sessions,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'homepage_impression') = 0 THEN NULL
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE event_type = 'homepage_click')
      / NULLIF(COUNT(*) FILTER (WHERE event_type = 'homepage_impression'), 0),
      2
    )
  END AS ctr_pct
FROM public.story_events
WHERE occurred_at >= now() - interval '7 days'
GROUP BY pillar;

GRANT SELECT ON public.content_pillar_metrics_7d TO authenticated;
