-- Mark old pending civic Instagram posts as failed (created before civic filter)
UPDATE post_queue p
SET status = 'failed',
    error_message = 'Auto-cancelled: civic content filter now skips Instagram',
    metadata = jsonb_set(
      COALESCE(p.metadata, '{}'::jsonb),
      '{auto_cancelled_reason}',
      '"civic_cleanup"'::jsonb,
      true
    )
FROM content_queue c
WHERE p.story_id = c.id
  AND p.platform = 'instagram'
  AND c.category = 'civic'
  AND p.status IN ('pending', 'scheduled');