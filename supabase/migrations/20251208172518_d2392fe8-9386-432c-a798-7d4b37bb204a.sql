-- Update local Walworth sources to trust their locality (no geo-filtering needed)
UPDATE sources 
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{trust_locality}', 'true'::jsonb)
WHERE id IN (
  'c0a0fbf8-cb42-418b-813b-4d1cc573381a', -- TMJ4 Walworth County
  'fdaff72a-45b8-4248-8d1d-5afdae638487', -- TMJ4 Local News (Regional)
  '0f47db63-030f-44a8-8810-a9cbd844d517', -- Fox6 Walworth County
  '8136cd19-aa16-4dc3-b0f8-3885aa6c7b07', -- Fox6 Lake Geneva
  '3ad867cb-d4c3-45d9-a462-4e05c8603eec', -- Walworth County Sheriff News
  'b36bbc11-b579-4b69-bd23-751612c6c1d7', -- Walworth County Community News
  'a81e36c1-a767-4a10-bed3-be3017e7c3b1'  -- Kenosha News - Walworth
);