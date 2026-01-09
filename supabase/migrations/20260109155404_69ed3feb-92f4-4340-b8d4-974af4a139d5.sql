-- Revert the bad data changes (invented prices)
UPDATE restaurant_deals SET
  price = NULL,
  confidence_score = 0.35
WHERE id = '044efd47-b470-4d28-bec4-3bf20b5faf10'; -- Chucks - restore original confidence

UPDATE restaurant_deals SET price = NULL
WHERE id IN ('75ed4c52-6d30-455a-b211-aca32b073ade', '20a3ad2e-40aa-4a63-9b88-3bf1a435a802');

-- Set manual_verified for the 3 restaurants we've enriched with local_reputation
-- This is the proper editorial override mechanism
UPDATE restaurant_deals SET verification_status = 'manual_verified'
WHERE id IN (
  '75ed4c52-6d30-455a-b211-aca32b073ade',  -- Pier 290
  '044efd47-b470-4d28-bec4-3bf20b5faf10',  -- Chucks
  '20a3ad2e-40aa-4a63-9b88-3bf1a435a802'   -- Geneva National
);