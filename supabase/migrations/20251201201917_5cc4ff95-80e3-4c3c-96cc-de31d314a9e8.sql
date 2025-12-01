-- Create business_profiles table
CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT, -- restaurant, real-estate, retail, services, professional
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  description TEXT,
  logo_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ad_slots table
CREATE TABLE ad_slots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('newsletter', 'web', 'social')),
  description TEXT,
  dimensions TEXT,
  price_monthly INTEGER, -- in cents
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Create ad_placements table
CREATE TABLE ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  slot_id TEXT REFERENCES ad_slots(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'expired', 'cancelled')),
  label TEXT,
  creative_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_profiles
CREATE POLICY "Admins can view all businesses"
  ON business_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage businesses"
  ON business_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for ad_slots
CREATE POLICY "Admins can view all ad slots"
  ON ad_slots FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ad slots"
  ON ad_slots FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for ad_placements
CREATE POLICY "Admins can view all placements"
  ON ad_placements FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage placements"
  ON ad_placements FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- System can read active placements for rendering
CREATE POLICY "System can read active placements"
  ON ad_placements FOR SELECT
  USING (true);

-- Seed initial ad slots
INSERT INTO ad_slots (id, name, channel, description, dimensions, price_monthly) VALUES
  ('newsletter_header', 'Newsletter Header Sponsor', 'newsletter', 'Premium placement at top of weekly newsletter', 'Featured block', 50000),
  ('newsletter_footer', 'Newsletter Footer', 'newsletter', 'Bottom of weekly newsletter', 'Standard block', 25000),
  ('newsletter_featured', 'Featured Story Sponsor', 'newsletter', 'Presented by... banner above featured stories', 'Inline banner', 35000);

-- Add updated_at trigger for business_profiles
CREATE TRIGGER update_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();