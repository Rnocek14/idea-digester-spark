-- Clean up remaining garbage performer data with ellipsis or truncation
UPDATE content_queue
SET performer = NULL
WHERE performer IS NOT NULL
  AND (
    performer LIKE '%…%'
    OR performer LIKE '%...%'
    OR performer LIKE 'in Lake Geneva%'
    OR performer LIKE 'DJ Alto%'
  );