-- Drop partial indexes and create a proper unique constraint
DROP INDEX IF EXISTS idx_restaurant_deals_hash;
DROP INDEX IF EXISTS restaurant_deals_deal_hash_uidx;

-- Create a proper unique constraint (not partial)
ALTER TABLE restaurant_deals ADD CONSTRAINT restaurant_deals_deal_hash_unique UNIQUE (deal_hash);