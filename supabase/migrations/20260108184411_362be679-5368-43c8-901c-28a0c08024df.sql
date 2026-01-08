-- 1) Create unique indexes for all upsert operations (IF NOT EXISTS pattern)
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_deals_deal_hash_uidx 
ON restaurant_deals (deal_hash) WHERE deal_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_pages_restaurant_id_url_uidx 
ON restaurant_pages (restaurant_id, url);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_scrape_jobs_source_id_uidx 
ON restaurant_scrape_jobs (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_uidx 
ON restaurants (slug);

-- 2) Fix activity_log entity_type constraint (drop and recreate with all types)
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;

-- Note: not adding constraint back - let any entity_type through for flexibility

-- 3) Fix sources type constraint to include more options
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check 
CHECK (type IN ('rss', 'api', 'scrape', 'firecrawl', 'diy-scrape', 'manual'));