WITH ranked AS (
  SELECT pq.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        DATE(pq.scheduled_for),
        CASE
          WHEN lower(cq.title) LIKE '%abbey resort%' THEN 'abbey'
          WHEN lower(cq.title) LIKE '%bar west%' THEN 'abbey'
          WHEN lower(cq.title) LIKE '%240 west%' THEN 'abbey'
          WHEN lower(cq.title) LIKE '%geneva tap house%' THEN 'geneva_tap'
          ELSE cq.id::text
        END
      ORDER BY pq.scheduled_for ASC
    ) AS rn
  FROM post_queue pq
  JOIN content_queue cq ON cq.id = pq.story_id
  WHERE pq.platform = 'x'
    AND pq.status = 'pending'
    AND cq.category IN ('events','entertainment','dining','nightlife')
)
UPDATE post_queue
SET status = 'expired',
    error_message = 'Venue/category dedup cleanup',
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('cancelled_at', now(), 'cancel_reason', 'venue_dedup_cleanup')
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);