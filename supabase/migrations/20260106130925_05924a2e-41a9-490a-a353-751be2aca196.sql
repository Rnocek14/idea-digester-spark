-- Fix incorrectly geo-tagged Milwaukee/non-local stories
-- Set geo_tier = 0 for stories that mention non-local cities in title but have no Lake Geneva keywords

UPDATE public.content_queue
SET 
  geo_tier = 0,
  geo_label = NULL
WHERE 
  geo_tier > 0
  AND (
    -- Title contains Milwaukee or other non-local cities
    LOWER(title) LIKE '%milwaukee%'
    OR LOWER(title) LIKE '%madison%'
    OR LOWER(title) LIKE '%chicago%'
    OR LOWER(title) LIKE '%racine%'
    OR LOWER(title) LIKE '%kenosha%'
    OR LOWER(title) LIKE '%waukesha%'
    OR LOWER(title) LIKE '%janesville%'
    OR LOWER(title) LIKE '%beloit%'
    OR LOWER(title) LIKE '%rockford%'
  )
  AND NOT (
    -- But does NOT contain Lake Geneva area keywords
    LOWER(title) LIKE '%lake geneva%'
    OR LOWER(title) LIKE '%walworth county%'
    OR LOWER(title) LIKE '%fontana%'
    OR LOWER(title) LIKE '%williams bay%'
    OR LOWER(title) LIKE '%elkhorn%'
    OR LOWER(title) LIKE '%delavan%'
    OR LOWER(title) LIKE '%geneva lake%'
    OR LOWER(summary) LIKE '%lake geneva%'
    OR LOWER(summary) LIKE '%walworth county%'
  );