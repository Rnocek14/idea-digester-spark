-- Fix search_path for generate_referral_code function
CREATE OR REPLACE FUNCTION generate_referral_code(email_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = public
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