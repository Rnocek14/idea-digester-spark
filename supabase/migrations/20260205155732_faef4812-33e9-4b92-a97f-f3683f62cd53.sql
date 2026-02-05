-- Clean up source names with trailing dashes or formatting issues
UPDATE sources
SET name = TRIM(REGEXP_REPLACE(name, '\s*[-–—]+\s*$', ''))
WHERE name ~ '\s*[-–—]+\s*$';

-- Also clean up any double spaces
UPDATE sources
SET name = REGEXP_REPLACE(name, '\s{2,}', ' ', 'g')
WHERE name ~ '\s{2,}';