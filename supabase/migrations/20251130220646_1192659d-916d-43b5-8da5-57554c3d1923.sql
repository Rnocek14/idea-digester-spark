-- Create subscribers table with token-based unsubscribe and multi-city support
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  unsubscribe_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  city_id UUID, -- nullable for now, ready for multi-city expansion
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast token lookups
CREATE INDEX idx_subscribers_unsubscribe_token ON subscribers(unsubscribe_token);
CREATE INDEX idx_subscribers_city_id ON subscribers(city_id);
CREATE INDEX idx_subscribers_status ON subscribers(status);

-- Enable RLS
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (public signup form)
CREATE POLICY "Anyone can subscribe" ON subscribers 
  FOR INSERT WITH CHECK (true);

-- Admins can view all subscribers
CREATE POLICY "Admins can view subscribers" ON subscribers 
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins can manage subscribers
CREATE POLICY "Admins can manage subscribers" ON subscribers 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- System can update subscriber status (for unsubscribe endpoint)
CREATE POLICY "System can update unsubscribe status" ON subscribers 
  FOR UPDATE USING (true) WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_subscribers_updated_at
  BEFORE UPDATE ON subscribers
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add auto_send_enabled toggle to newsletters table
ALTER TABLE newsletters ADD COLUMN auto_send_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN subscribers.unsubscribe_token IS 'Secure token for unsubscribe links, never expose email in URLs';
COMMENT ON COLUMN subscribers.city_id IS 'Multi-city support - NULL means Lake Geneva (default city) for now';
COMMENT ON COLUMN newsletters.auto_send_enabled IS 'Safety toggle - must be explicitly enabled for automatic email sending';