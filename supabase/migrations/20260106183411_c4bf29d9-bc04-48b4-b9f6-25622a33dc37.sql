-- Re-enable Library and Geneva Lake West Chamber sources
UPDATE sources 
SET status = 'active', 
    metadata = metadata - 'disabled_at' - 'disabled_reason' - 'consecutive_failures'
WHERE id IN (
  'c581d8db-3147-4489-95be-3d9fc9b5c720',
  '95511f9f-7d5e-41c1-9a0f-696ea7cd25f7'
);

-- Delete dead sources (Grand Geneva Nightlife, Hogs & Kisses, Mars Resort)
DELETE FROM sources 
WHERE id IN (
  'ddd096d6-5712-40da-a5a7-5d2859c3a618',
  'c398ec8e-8ef1-48e4-bb18-2f090f5a0d65',
  'b914a262-1d8c-48bd-a5c5-1ada9f4e6a6d'
);