-- Part 1: Clean up expired posts in queue
-- Mark pending posts as expired when their linked story is expired
UPDATE post_queue pq
SET status = 'expired'
FROM content_queue cq
WHERE pq.story_id = cq.id
  AND pq.status = 'pending'
  AND cq.status = 'expired';

-- Part 2: Add more flexible auto-publish rules for regional news
-- Auto-publish events from any source (high-value, low-risk)
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal)
VALUES (null, 'events', 'auto_publish', false)
ON CONFLICT DO NOTHING;

-- Auto-publish community content without hyperlocal requirement
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal)
VALUES (null, 'community', 'auto_publish', false)
ON CONFLICT DO NOTHING;

-- Auto-publish dining content (restaurants, food news)
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal)
VALUES (null, 'dining', 'auto_publish', false)
ON CONFLICT DO NOTHING;