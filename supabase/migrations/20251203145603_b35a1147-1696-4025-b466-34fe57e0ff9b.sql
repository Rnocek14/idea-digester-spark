-- Delete duplicate civic content (City Calendar), keeping only the newest version per title + publish_date
DELETE FROM content_queue 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY title, DATE(publish_date) 
      ORDER BY created_at DESC
    ) as rn
    FROM content_queue 
    WHERE source_id = 'c55186ae-7464-4ded-983c-b32407eb95d5'
  ) t WHERE rn > 1
);

-- Also delete future-dated stories that shouldn't be showing yet (publish_date > today)
DELETE FROM content_queue 
WHERE publish_date > NOW() + INTERVAL '1 day'
AND source_id = 'c55186ae-7464-4ded-983c-b32407eb95d5';