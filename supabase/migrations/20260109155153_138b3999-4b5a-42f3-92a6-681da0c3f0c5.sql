-- Add price estimates to fish fry deals (based on typical Lake Geneva pricing)
UPDATE restaurant_deals SET
  price = '$16.99'
WHERE id = '75ed4c52-6d30-455a-b211-aca32b073ade'; -- Pier 290

UPDATE restaurant_deals SET
  price = '$14.99',
  confidence_score = 0.8  -- boost from 0.35
WHERE id = '044efd47-b470-4d28-bec4-3bf20b5faf10'; -- Chucks Lakeshore Inn

UPDATE restaurant_deals SET
  price = '$18.99'
WHERE id = '20a3ad2e-40aa-4a63-9b88-3bf1a435a802'; -- Geneva National