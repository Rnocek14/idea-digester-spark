-- Extend Gina Nocek's ad placement end date (was expired 2026-01-01)
UPDATE ad_placements 
SET end_date = '2026-03-31' 
WHERE id = '8f0b2d0c-c28b-460a-be5d-8aa749a95d62';