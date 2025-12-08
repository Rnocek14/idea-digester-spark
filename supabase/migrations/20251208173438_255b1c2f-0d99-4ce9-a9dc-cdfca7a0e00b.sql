
-- Disable the Facebook source since it can't be scraped
UPDATE sources 
SET status = 'inactive', 
    metadata = metadata || '{"disabled_reason": "Facebook blocks scraping - use county news page instead"}'::jsonb
WHERE name = 'Walworth County Sheriff Facebook';

-- Check/update the county news page configuration  
UPDATE sources
SET metadata = metadata || '{"trust_locality": true, "is_incident_source": true}'::jsonb
WHERE name = 'Walworth County Sheriff News';
