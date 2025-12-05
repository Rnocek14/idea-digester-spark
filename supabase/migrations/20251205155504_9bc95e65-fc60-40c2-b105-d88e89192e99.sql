-- Deactivate Patch (newsletter format doesn't scrape cleanly)
UPDATE sources SET status = 'inactive'
WHERE name = 'Lake Geneva Patch';