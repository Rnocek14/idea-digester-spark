-- Backfill existing relative URLs by prepending the source's base domain
UPDATE content_queue cq
SET original_url = 
  (SELECT 
    CONCAT(
      CASE 
        WHEN s.url LIKE 'https://%' THEN 'https://'
        ELSE 'http://'
      END,
      SUBSTRING(s.url FROM '://([^/]+)'),
      cq.original_url
    )
   FROM sources s 
   WHERE s.id = cq.source_id
  )
WHERE cq.original_url LIKE '/%'
  AND cq.original_url NOT LIKE '//%'
  AND cq.source_id IS NOT NULL;