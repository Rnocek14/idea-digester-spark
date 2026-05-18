-- Self-heal backlog: unlock T1 hyperlocal and T2 (allowed-category) stories
-- stuck on the old "no_matching_rule" gate. Mirrors the new in-code self-heal
-- in sync-rss/decideStatusForStory.
UPDATE public.content_queue
SET status = 'auto_published',
    hold_reason = NULL,
    decision_path = 'backfill_self_heal',
    updated_at = NOW()
WHERE status = 'pending'
  AND created_at >= NOW() - INTERVAL '30 days'
  AND geo_tier >= 1
  AND safety_level IN ('safe', 'soft_sensitive')
  AND hold_reason IN ('no_matching_rule', 'rule_needs_review')
  AND (
    geo_tier = 1
    OR (geo_tier = 2 AND category IN ('events','eats','nightlife','community','civic','news','schools','weather'))
  );