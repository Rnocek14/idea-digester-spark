-- Add referral tracking columns to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_code text,
ADD COLUMN IF NOT EXISTS referral_count integer DEFAULT 0;

-- Create index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_referral_code ON public.subscribers(referral_code);
CREATE INDEX IF NOT EXISTS idx_subscribers_referred_by_code ON public.subscribers(referred_by_code);

-- Function to generate a unique referral code from email
CREATE OR REPLACE FUNCTION generate_referral_code(email_input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_code text;
  final_code text;
  counter integer := 0;
BEGIN
  -- Create base code from email (first 6 chars of md5 hash, uppercase)
  base_code := upper(substring(md5(lower(email_input)) from 1 for 6));
  final_code := base_code;
  
  -- Check for uniqueness, add suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.subscribers WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter::text;
  END LOOP;
  
  RETURN final_code;
END;
$$;

-- Trigger to auto-generate referral code on insert
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_referral_code ON public.subscribers;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION set_referral_code();

-- Function to increment referral count when someone uses a referral code
CREATE OR REPLACE FUNCTION increment_referral_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    UPDATE public.subscribers 
    SET referral_count = referral_count + 1
    WHERE referral_code = NEW.referred_by_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_increment_referral_count ON public.subscribers;
CREATE TRIGGER trigger_increment_referral_count
  AFTER INSERT ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION increment_referral_count();

-- Backfill referral codes for existing subscribers
UPDATE public.subscribers 
SET referral_code = generate_referral_code(email)
WHERE referral_code IS NULL;