-- Clean up garbage performer data in content_queue
UPDATE content_queue 
SET performer = NULL 
WHERE performer IS NOT NULL AND (
  performer ILIKE 'at %' 
  OR performer ILIKE 'at the %'
  OR performer ILIKE '@%'
  OR performer ILIKE '%PIER%'
  OR performer ILIKE '%Resort%'
  OR performer ILIKE '%Tap House%'
  OR performer ILIKE '%Lookout%'
  OR performer ILIKE '%Enjoy live music%'
  OR performer ILIKE '%humor%'
  OR performer ILIKE '%wit%'
  OR performer ILIKE '%joyous%'
  OR performer ILIKE '%casino%'
  OR performer ILIKE '%cocktail%'
  OR performer ILIKE '%Carson Hall%'
  OR LENGTH(performer) > 60
);