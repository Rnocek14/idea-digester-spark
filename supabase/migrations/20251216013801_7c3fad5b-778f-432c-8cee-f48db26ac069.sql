-- Disable City of Lake Geneva Calendar source (CivicEngage has strong bot protection)
UPDATE sources 
SET status = 'inactive'
WHERE name = 'City of Lake Geneva Calendar';