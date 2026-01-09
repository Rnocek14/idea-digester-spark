-- Enrich restaurants with feature-grade content
UPDATE restaurants SET
  local_reputation = 'Lakefront staple known for the view and a lively supper-club atmosphere.',
  distinguishing_feature = 'Lakefront dining with a popular patio; good pick if you want fish fry plus a scenic setting.',
  is_lakefront = true
WHERE id = 'e159428d-06d7-4486-b9dc-3bf990946343'; -- Pier 290

UPDATE restaurants SET
  local_reputation = 'Classic lakeside supper club vibe — straightforward, dependable, and longtime local.',
  distinguishing_feature = 'Old-school lakeshore inn feel; great if you''re after a traditional fish fry night.',
  is_lakefront = true
WHERE id = '8a7b6430-79d3-4dec-8843-2dd91af3d4e1'; -- Chucks Lakeshore Inn

UPDATE restaurants SET
  local_reputation = 'A polished, resort-style option — good for a nicer night out.',
  distinguishing_feature = 'Upscale setting and dining experience; a good choice if you want a more ''date night'' fish fry.'
WHERE id = '2cb47681-be5f-4727-9b2a-6cf403ece90c'; -- Geneva National Resort Dining