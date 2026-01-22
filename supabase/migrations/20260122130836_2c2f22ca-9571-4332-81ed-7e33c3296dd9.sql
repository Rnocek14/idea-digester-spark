-- Clean garbage performer data from content_queue
UPDATE content_queue
SET performer = NULL
WHERE performer IS NOT NULL
AND (
  -- Too long to be a real performer name
  LENGTH(performer) > 50
  -- Contains garbage keywords indicating scraped description fragments
  OR performer ILIKE '%enjoy%craft beer%'
  OR performer ILIKE '%a bang at%'
  OR performer ILIKE '%free live music%'
  OR performer ILIKE '%menu%'
  OR performer ILIKE '%dinner%'
  OR performer ILIKE '%experience%'
  OR performer ILIKE '%welcome%'
  OR performer ILIKE '%featuring%'
  OR performer ILIKE '%cocktail%'
  OR performer ILIKE '%resort%'
  -- Contains URLs
  OR performer ILIKE '%http%'
  OR performer ILIKE '%www.%'
  -- Placeholder values
  OR performer ILIKE '%tbd%'
  OR performer ILIKE '%to be determined%'
  OR performer ILIKE '%various artists%'
  OR performer ILIKE '%special guest%'
);