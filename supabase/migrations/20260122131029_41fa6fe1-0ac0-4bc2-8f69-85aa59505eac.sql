-- Fix broken venue source URLs and re-enable them

-- Fat Cat's: The events page doesn't exist at fatcatslakegeneva.com
-- The working source is fatcatslounge.com - delete the broken venue source
DELETE FROM sources WHERE id = '1e2e02f7-f240-4913-b56d-36869f37a9f7';

-- Gordy's Boat House: Multiple broken entries - consolidate to use Facebook (which works)
-- Delete the broken venue scraper entries
DELETE FROM sources WHERE id = 'd39bc5d2-005e-4a8f-8a44-3dfdc84b1fff';
DELETE FROM sources WHERE id = 'b6dc0d3d-2555-4607-988a-9c2d5d773b1d';

-- Mars Resort: Wrong URL with www prefix - fix it and mark as venue source
UPDATE sources 
SET 
  url = 'https://themarsresort.com/',
  metadata = jsonb_set(
    jsonb_set(
      COALESCE(metadata, '{}'::jsonb) - 'last_error' - 'consecutive_failures' - 'disabled_at' - 'disabled_reason',
      '{venue}', 'true'::jsonb
    ),
    '{scraper}', '"venue-calendar"'::jsonb
  ),
  status = 'active'
WHERE id = 'efd3c46a-e732-43ec-bd07-0838d2afcc43';

-- Delete the duplicate broken Mars Resort entry with www prefix
DELETE FROM sources WHERE id = 'aa6d323d-c7e9-4af5-9639-60d64abaf1dc';

-- Delete the broken Mars Resort Entertainment entry (wrong URL)
DELETE FROM sources WHERE id = '8bb046e1-9d22-4bf1-9455-f414ff7f8652';

-- Re-enable Crafted Americana with correct status (their events page may work)
UPDATE sources 
SET 
  status = 'active',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb) - 'last_error' - 'consecutive_failures' - 'disabled_at' - 'disabled_reason' - 'last_error_at',
    '{scraper}', '"venue-calendar"'::jsonb
  )
WHERE id = '8e3ec071-37f2-4ee6-bdce-41a01632fd86';

-- Re-enable House of Music (lghom.com)
UPDATE sources 
SET 
  status = 'active',
  metadata = COALESCE(metadata, '{}'::jsonb) - 'last_error' - 'consecutive_failures' - 'disabled_at' - 'disabled_reason' - 'last_error_at'
WHERE id = 'b7d52234-03b3-45c4-8cdb-ab80fa815ab6';