-- Disable duplicate source (keep the original, disable the "– Lake Geneva" variant)
UPDATE sources 
SET status = 'inactive'
WHERE id = 'b36bbc11-b579-4b69-bd23-751612c6c1d7';

-- Also delete the duplicate story
DELETE FROM content_queue 
WHERE id = '03e0c194-dcba-404b-b67c-09a848551332';