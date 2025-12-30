-- Create job_listings table for Local Work Opportunities
CREATE TABLE job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional linkage to business directory
  business_id uuid REFERENCES business_profiles(id) ON DELETE SET NULL,
  business_name text NOT NULL,

  title text NOT NULL,
  category text NOT NULL,     -- hospitality, retail, trades, services, seasonal
  job_type text NOT NULL,     -- full-time, part-time, seasonal, contract

  description text NOT NULL,
  location_text text,         -- "Downtown Lake Geneva"

  -- Pay (structured for filtering + display)
  pay_min numeric,
  pay_max numeric,
  pay_type text,              -- hourly | salary | contract
  pay_display text,           -- "$16–20/hr + tips" or "DOE"

  -- Application contact
  contact_email text NOT NULL,
  contact_phone text,
  apply_url text,

  -- Monetization & editorial
  is_featured boolean DEFAULT false,
  pricing_tier text DEFAULT 'standard',     -- standard | featured | bundle
  payment_status text DEFAULT 'unpaid',     -- unpaid | paid | comped
  amount_cents integer,
  paid_at timestamptz,

  -- Status workflow: pending → approved → expired (or rejected)
  status text DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_job_listings_status_expires ON job_listings (status, expires_at DESC);
CREATE INDEX idx_job_listings_category_type ON job_listings (category, job_type);
CREATE INDEX idx_job_listings_featured ON job_listings (is_featured, created_at DESC);

-- Enable RLS
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

-- Public can view approved, non-expired jobs
CREATE POLICY "Public can view approved jobs"
ON job_listings
FOR SELECT
USING (status = 'approved' AND expires_at > now());

-- Admins can view all jobs
CREATE POLICY "Admins can view all jobs"
ON job_listings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all jobs
CREATE POLICY "Admins can manage jobs"
ON job_listings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can submit job listings (goes to pending)
CREATE POLICY "Anyone can submit jobs"
ON job_listings
FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_job_listings_updated_at
BEFORE UPDATE ON job_listings
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();