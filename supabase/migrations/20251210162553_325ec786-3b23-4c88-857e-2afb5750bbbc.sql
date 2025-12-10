
-- Clean up old regional/Milwaukee incidents that were created before geo_tier filter was applied
-- Delete incident_updates first (foreign key constraint)
DELETE FROM incident_updates 
WHERE incident_id IN (
  SELECT i.id 
  FROM incidents i
  LEFT JOIN content_queue cq ON i.source_story_id = cq.id
  WHERE i.source = 'backfill' AND (cq.geo_tier IS NULL OR cq.geo_tier = 0 OR cq.geo_tier = 2)
);

-- Delete the incidents themselves
DELETE FROM incidents 
WHERE id IN (
  SELECT i.id 
  FROM incidents i
  LEFT JOIN content_queue cq ON i.source_story_id = cq.id
  WHERE i.source = 'backfill' AND (cq.geo_tier IS NULL OR cq.geo_tier = 0 OR cq.geo_tier = 2)
);
