-- Disable City Calendar source (returns 403, needs different approach)
UPDATE sources SET status = 'inactive' WHERE name = 'City of Lake Geneva Calendar';