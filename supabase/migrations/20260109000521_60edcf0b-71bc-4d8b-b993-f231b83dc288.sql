-- Add restaurant status tracking columns
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_date DATE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closing_date DATE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closure_reason TEXT;

-- Restaurant news/updates tracking table
CREATE TABLE IF NOT EXISTS restaurant_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  news_type TEXT NOT NULL CHECK (news_type IN ('opening', 'closing', 'review', 'menu_update', 'chef_change', 'renovation', 'award', 'other')),
  headline TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews aggregation table
CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('yelp', 'google', 'tripadvisor', 'facebook', 'user_submitted')),
  rating NUMERIC(2,1),
  review_count INTEGER,
  excerpt TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, platform)
);

-- Enable RLS
ALTER TABLE restaurant_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can read restaurant news" ON restaurant_news FOR SELECT USING (true);
CREATE POLICY "Anyone can read restaurant reviews" ON restaurant_reviews FOR SELECT USING (true);

-- Service role insert/update
CREATE POLICY "Service can manage restaurant news" ON restaurant_news FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage restaurant reviews" ON restaurant_reviews FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_news_restaurant ON restaurant_news(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_news_type ON restaurant_news(news_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_news_published ON restaurant_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status);