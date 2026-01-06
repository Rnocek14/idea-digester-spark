-- Add auto-publish rules for TMJ4 Walworth County (trusted local source)
-- This source only covers Walworth County, so we can auto-publish hyperlocal content

INSERT INTO public.auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
VALUES 
  -- TMJ4 Walworth County - auto-publish news with hyperlocal requirement (tier 1 or 2)
  ('c0a0fbf8-cb42-418b-813b-4d1cc573381a', 'news', 'auto_publish', true, true),
  ('c0a0fbf8-cb42-418b-813b-4d1cc573381a', 'community', 'auto_publish', true, true),
  ('c0a0fbf8-cb42-418b-813b-4d1cc573381a', 'civic', 'auto_publish', true, true),
  ('c0a0fbf8-cb42-418b-813b-4d1cc573381a', 'events', 'auto_publish', true, true)
ON CONFLICT DO NOTHING;

-- Also add global auto-publish rule for community content with hyperlocal requirement
-- This helps more community content get through if it's clearly local
INSERT INTO public.auto_publish_rules (source_id, category, action, enabled, requires_hyperlocal)
VALUES 
  (NULL, 'community', 'auto_publish', true, true),
  (NULL, 'events', 'auto_publish', true, true)
ON CONFLICT DO NOTHING;