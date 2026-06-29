UPDATE public.content_queue
SET geo_tier = 0, geo_label = NULL, status = 'rejected',
    hold_reason = COALESCE(hold_reason, 'regional_title'),
    decision_path = COALESCE(decision_path,'') || E'\nretro: title names non-local metro'
WHERE status IN ('auto_published','published')
  AND geo_tier IN (1, 2)
  AND created_at >= now() - interval '14 days'
  AND title ~* '(milwaukee|madison|kenosha|racine|waukesha|southeast wisconsin|chicago|illinois)';