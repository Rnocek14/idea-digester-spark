
-- Reclassify obvious false-positive sensitive stories to soft_sensitive
UPDATE content_queue SET safety_level = 'soft_sensitive', safety_reason = 'Reclassified: public-interest civic/community/lifestyle content'
WHERE status = 'pending' AND safety_level = 'sensitive' 
AND (
  title ILIKE '%park%development%' 
  OR title ILIKE '%wedding dress%' 
  OR title ILIKE '%penguin%dies%' 
  OR title ILIKE '%penguin%zoo%'
  OR title ILIKE '%Olympic%gold%'
  OR title ILIKE '%falls short%'
  OR title ILIKE '%documentary%premieres%'
  OR title ILIKE '%childcare center%'
  OR title ILIKE '%data center project%'
  OR title ILIKE '%town hall%rally%'
  OR title ILIKE '%preserves nature%'
  OR title ILIKE '%workforce%mobilize%'
  OR title ILIKE '%skeleton racer%'
  OR title ILIKE '%What to watch at the%'
);
