-- Add columns for reward tracking
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_breaking_email_at timestamptz;

-- Create ambassador_deals table for exclusive deals
CREATE TABLE public.ambassador_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  discount_code text,
  valid_until date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on ambassador_deals
ALTER TABLE public.ambassador_deals ENABLE ROW LEVEL SECURITY;

-- Public can read active deals (verification happens in app)
CREATE POLICY "Anyone can view active deals"
ON public.ambassador_deals
FOR SELECT
USING (is_active = true);

-- Only admins can manage deals
CREATE POLICY "Admins can manage deals"
ON public.ambassador_deals
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger to auto-set VIP status when referral_count >= 10
CREATE OR REPLACE FUNCTION public.update_vip_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_count >= 10 AND (OLD.referral_count IS NULL OR OLD.referral_count < 10) THEN
    NEW.is_vip := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_vip_status
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vip_status();

-- Also set VIP on insert if they somehow start with 10+ referrals
CREATE OR REPLACE FUNCTION public.set_vip_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_count >= 10 THEN
    NEW.is_vip := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_set_vip_on_insert
  BEFORE INSERT ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vip_on_insert();

-- Backfill existing VIP Champions
UPDATE public.subscribers SET is_vip = true WHERE referral_count >= 10;

-- Add updated_at trigger for ambassador_deals
CREATE TRIGGER update_ambassador_deals_updated_at
  BEFORE UPDATE ON public.ambassador_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();