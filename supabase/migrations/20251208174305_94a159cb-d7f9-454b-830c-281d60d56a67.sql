-- Disable Walworth County Sheriff News - county site blocks scraping
UPDATE sources 
SET status = 'inactive', 
    metadata = metadata || '{"disabled_reason": "County website blocks scraping"}'::jsonb
WHERE name = 'Walworth County Sheriff News';

-- Check if there are any other incident-related sources we can enable
-- Looking at existing sources that might have incident content