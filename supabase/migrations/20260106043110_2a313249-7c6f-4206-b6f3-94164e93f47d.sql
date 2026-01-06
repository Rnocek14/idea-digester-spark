-- Create function to notify tier-up via edge function
CREATE OR REPLACE FUNCTION public.notify_tier_up()
RETURNS TRIGGER AS $$
DECLARE
  tier_thresholds int[] := ARRAY[1, 3, 5, 10];
  old_count int;
  new_count int;
  threshold int;
  crossed_tier boolean := false;
BEGIN
  old_count := COALESCE(OLD.referral_count, 0);
  new_count := COALESCE(NEW.referral_count, 0);
  
  -- Check if we crossed any tier threshold
  FOREACH threshold IN ARRAY tier_thresholds
  LOOP
    IF old_count < threshold AND new_count >= threshold THEN
      crossed_tier := true;
      EXIT;
    END IF;
  END LOOP;
  
  -- If crossed a tier, call the edge function
  IF crossed_tier THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-tier-up',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'subscriber_id', NEW.id,
        'email', NEW.email,
        'new_referral_count', new_count,
        'old_referral_count', old_count
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to fire on referral_count updates
DROP TRIGGER IF EXISTS trigger_notify_tier_up ON public.subscribers;
CREATE TRIGGER trigger_notify_tier_up
  AFTER UPDATE OF referral_count ON public.subscribers
  FOR EACH ROW
  WHEN (NEW.referral_count IS DISTINCT FROM OLD.referral_count)
  EXECUTE FUNCTION public.notify_tier_up();