-- Auto-Publish Rules Seed Data
-- Run this in Supabase SQL Editor to populate initial rules
-- Project: mzumvkrpnxhkvhdyzgqa

-- Auto-publish ALL events from Visit Lake Geneva
INSERT INTO auto_publish_rules (source_id, category, action)
VALUES ('b219479c-5c29-49d0-82df-adaa230e8761', 'events', 'auto_publish');

-- Auto-publish community items from Walworth County Community News
INSERT INTO auto_publish_rules (source_id, category, action)
VALUES ('b36bbc11-b579-4b69-bd23-751612c6c1d7', 'community', 'auto_publish');

-- Global default: news always needs review
INSERT INTO auto_publish_rules (source_id, category, action)
VALUES (null, 'news', 'needs_review');

-- Verify rules were created
SELECT 
  r.id,
  s.name as source_name,
  r.category,
  r.action,
  r.enabled
FROM auto_publish_rules r
LEFT JOIN sources s ON s.id = r.source_id
ORDER BY r.created_at;
