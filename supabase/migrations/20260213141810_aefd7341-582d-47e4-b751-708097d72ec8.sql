
-- Add global auto-publish rule for events category
INSERT INTO auto_publish_rules (category, action, enabled, requires_hyperlocal)
SELECT 'events', 'auto_publish', true, false
WHERE NOT EXISTS (
  SELECT 1 FROM auto_publish_rules WHERE category = 'events' AND source_id IS NULL AND action = 'auto_publish'
);

-- Auto-publish the 10 stuck safe events
UPDATE content_queue 
SET status = 'auto_published', reviewed_at = now()
WHERE status = 'pending' AND safety_level = 'safe' AND category = 'events';

-- Clean garbage performer values (sentence fragments, too long, stop-phrase matches)
UPDATE content_queue 
SET performer = NULL 
WHERE performer IS NOT NULL 
AND (
  LENGTH(performer) > 50 
  OR performer ~* '(then from|your kids|click here|http|register|discounts and|planned tributes|syrup for grip|businesses The University|bringing the laughs)'
);
