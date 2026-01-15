-- Drop and recreate with COALESCE for safer boolean cast
CREATE OR REPLACE FUNCTION public.get_source_health_stats()
RETURNS TABLE (
  source_id uuid,
  stories_24h bigint,
  stories_7d bigint,
  breaking_24h bigint,
  firecrawl_7d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cq.source_id,
    COUNT(*) FILTER (WHERE cq.created_at >= NOW() - INTERVAL '24 hours') as stories_24h,
    COUNT(*) as stories_7d,
    COUNT(*) FILTER (WHERE cq.created_at >= NOW() - INTERVAL '24 hours' AND cq.is_breaking = true) as breaking_24h,
    COUNT(*) FILTER (WHERE COALESCE((cq.metadata->>'used_firecrawl')::boolean, false) = true) as firecrawl_7d
  FROM content_queue cq
  WHERE cq.source_id IS NOT NULL
    AND cq.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY cq.source_id;
$$;