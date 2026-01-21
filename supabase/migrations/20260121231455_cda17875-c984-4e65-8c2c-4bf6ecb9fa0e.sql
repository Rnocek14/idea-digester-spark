-- Skip aggregation RPC for unified pipeline health diagnostics
-- Returns both 24h and 7d aggregates with top sources
CREATE OR REPLACE FUNCTION public.get_skip_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  now_ts timestamptz := now();
  ts_24h timestamptz := now_ts - interval '24 hours';
  ts_7d timestamptz := now_ts - interval '7 days';
BEGIN
  SELECT jsonb_build_object(
    'total24h', COALESCE((SELECT COUNT(*) FROM sync_skips WHERE created_at >= ts_24h), 0),
    'total7d', COALESCE((SELECT COUNT(*) FROM sync_skips WHERE created_at >= ts_7d), 0),
    'byReason24h', COALESCE((
      SELECT jsonb_object_agg(reason, cnt)
      FROM (
        SELECT reason, COUNT(*) as cnt
        FROM sync_skips
        WHERE created_at >= ts_24h
        GROUP BY reason
      ) sub
    ), '{}'::jsonb),
    'byReason7d', COALESCE((
      SELECT jsonb_object_agg(reason, cnt)
      FROM (
        SELECT reason, COUNT(*) as cnt
        FROM sync_skips
        WHERE created_at >= ts_7d
        GROUP BY reason
      ) sub
    ), '{}'::jsonb),
    'topSources24h', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('source_name', source_name, 'count', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT COALESCE(source_name, 'Unknown') as source_name, COUNT(*) as cnt
        FROM sync_skips
        WHERE created_at >= ts_24h
        GROUP BY source_name
        ORDER BY cnt DESC
        LIMIT 10
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$function$;