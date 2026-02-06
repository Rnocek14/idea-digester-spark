
-- 1. Change global news rule from needs_review to auto_publish
UPDATE auto_publish_rules 
SET action = 'auto_publish', updated_at = now()
WHERE id = '8f8a7848-607e-48e0-8a8c-6f34a16a93ce';

-- 2. Change Patch Lake Geneva rules from needs_review to auto_publish
UPDATE auto_publish_rules 
SET action = 'auto_publish', updated_at = now()
WHERE source_id = '3e77fc52-e069-4d2a-af8c-b981c5f046bf';

-- 3. Add global community auto_publish rule
INSERT INTO auto_publish_rules (category, action, requires_hyperlocal, enabled)
VALUES ('community', 'auto_publish', false, true);

-- 4. Bulk-publish currently pending safe stories to clear the backlog
UPDATE content_queue 
SET status = 'auto_published', reviewed_at = now()
WHERE status = 'pending' AND safety_level = 'safe';
