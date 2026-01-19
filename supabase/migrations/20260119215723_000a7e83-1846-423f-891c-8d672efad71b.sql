-- STEP 1: Add Spectrum source-specific rules with requires_hyperlocal=true
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES 
  -- Spectrum News Wisconsin - Local (60dc02e3-eb9b-49a7-b6de-1500990d8846)
  ('60dc02e3-eb9b-49a7-b6de-1500990d8846', 'news', 'auto_publish', true, true),
  ('60dc02e3-eb9b-49a7-b6de-1500990d8846', 'civic', 'auto_publish', true, true),
  ('60dc02e3-eb9b-49a7-b6de-1500990d8846', 'community', 'auto_publish', true, true),
  -- Spectrum News Wisconsin - Weather (4e23e024-9733-4265-b3d2-de9ca638a986)
  ('4e23e024-9733-4265-b3d2-de9ca638a986', 'weather', 'auto_publish', true, true),
  ('4e23e024-9733-4265-b3d2-de9ca638a986', 'news', 'auto_publish', true, true)
ON CONFLICT DO NOTHING;

-- STEP 2: Set default_geo_tier=1 for local venue sources
UPDATE sources 
SET default_geo_tier = 1
WHERE id IN (
  '232ec20a-aecd-4517-9edb-da58a47a5085', -- Chucks Lakeshore Inn
  'fce15a32-4596-48b3-8bb7-005a12bc62de', -- DJs in the Drink
  '8a30101b-a2ef-408e-a20f-4de074b95aaa', -- Fat Cat's Lake Geneva
  'b6dc0d3d-2555-4607-988a-9c2d5d773b1d', -- Gordys Boat House - Events
  'd060cc0f-f1e3-4401-9f54-9b004f436c0c', -- Gordys Boathouse
  '720e89e9-b5ea-466a-83ca-2b8dcbab75dd', -- Hogs and Kisses
  'b2ca808e-65f1-44ee-a75d-5984887abb5c', -- Hogs and Kisses (dup)
  '383ac3fa-89f6-48ca-9b9a-9d6231d584e1', -- Hogs and Kisses Saloon
  'b7d52234-03b3-45c4-8cdb-ab80fa815ab6', -- House of Music - Events
  'e3fbd1fd-e807-474d-b238-04fb2980317b', -- Papa's Blue Spruce Resort - Events
  '6bf7de5b-d7da-46f6-aed5-2c5792cd922b', -- Pier 290
  '4f4aaf91-1450-469d-b8bc-c9a6e2de3d41', -- Thumbs Up Pub
  '3cc75af7-2cb0-418a-9e4a-10797b640150'  -- Topsy Turvy Brewery - Events
)
AND (default_geo_tier IS NULL OR default_geo_tier = 0);

-- STEP 4: Demote incorrectly auto-published regional stories (TMJ4 + Spectrum with geo_tier=0)
UPDATE content_queue
SET status = 'pending'
WHERE source_id IN (
  'fdaff72a-45b8-4248-8d1d-5afdae638487',  -- TMJ4 Local News (Regional)
  '60dc02e3-eb9b-49a7-b6de-1500990d8846',  -- Spectrum News Wisconsin - Local
  '4e23e024-9733-4265-b3d2-de9ca638a986'   -- Spectrum News Wisconsin - Weather
)
AND status = 'auto_published'
AND (geo_tier IS NULL OR geo_tier = 0)
AND created_at >= now() - interval '14 days';