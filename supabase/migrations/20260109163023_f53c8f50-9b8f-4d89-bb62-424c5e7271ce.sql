
-- Create hook_type enum for restaurant_news
CREATE TYPE public.hook_type AS ENUM (
  'event_series',
  'seasonal_menu', 
  'new_menu',
  'anniversary',
  'expansion',
  'renovation',
  'reopening',
  'award',
  'special_event',
  'announcement'
);

-- Add hook_type column to restaurant_news
ALTER TABLE public.restaurant_news 
ADD COLUMN hook_type public.hook_type;

-- Add is_current boolean with default true (will be auto-expired)
ALTER TABLE public.restaurant_news 
ADD COLUMN is_current boolean NOT NULL DEFAULT true;

-- Add expires_at for auto-expiration (default 60 days from published_at)
ALTER TABLE public.restaurant_news 
ADD COLUMN expires_at timestamp with time zone;

-- Add verified flag for editorial review
ALTER TABLE public.restaurant_news 
ADD COLUMN verified boolean NOT NULL DEFAULT false;

-- Create function to auto-set expires_at on insert/update
CREATE OR REPLACE FUNCTION public.set_news_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- If expires_at not set, default to 60 days from published_at or created_at
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.published_at, NEW.created_at) + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-set expiry
CREATE TRIGGER set_restaurant_news_expiry
BEFORE INSERT OR UPDATE ON public.restaurant_news
FOR EACH ROW
EXECUTE FUNCTION public.set_news_expiry();

-- Create function to check feature eligibility for a restaurant
-- Returns: eligible (boolean), reputation_signals (int), has_current_hook (boolean), details (jsonb)
CREATE OR REPLACE FUNCTION public.check_feature_eligibility(p_restaurant_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_restaurant restaurants%ROWTYPE;
  v_reputation_signals integer := 0;
  v_signal_details jsonb := '[]'::jsonb;
  v_has_current_hook boolean := false;
  v_current_hooks jsonb := '[]'::jsonb;
  v_guide_count integer := 0;
BEGIN
  -- Get restaurant data
  SELECT * INTO v_restaurant FROM restaurants WHERE id = p_restaurant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'error', 'Restaurant not found');
  END IF;
  
  -- Count reputation signals
  -- Signal 1: local_reputation exists
  IF v_restaurant.local_reputation IS NOT NULL AND v_restaurant.local_reputation != '' THEN
    v_reputation_signals := v_reputation_signals + 1;
    v_signal_details := v_signal_details || jsonb_build_array('local_reputation');
  END IF;
  
  -- Signal 2: distinguishing_feature exists
  IF v_restaurant.distinguishing_feature IS NOT NULL AND v_restaurant.distinguishing_feature != '' THEN
    v_reputation_signals := v_reputation_signals + 1;
    v_signal_details := v_signal_details || jsonb_build_array('distinguishing_feature');
  END IF;
  
  -- Signal 3: features array non-empty
  IF v_restaurant.features IS NOT NULL AND array_length(v_restaurant.features, 1) > 0 THEN
    v_reputation_signals := v_reputation_signals + 1;
    v_signal_details := v_signal_details || jsonb_build_array('features');
  END IF;
  
  -- Signal 4: guide inclusion (fish_fry or happy_hour data exists)
  IF v_restaurant.fish_fry IS NOT NULL OR v_restaurant.happy_hour IS NOT NULL THEN
    v_reputation_signals := v_reputation_signals + 1;
    v_signal_details := v_signal_details || jsonb_build_array('guide_inclusion');
  END IF;
  
  -- Signal 5: is_lakefront (only counts if paired with another signal)
  IF v_restaurant.is_lakefront = true AND v_reputation_signals >= 1 THEN
    v_reputation_signals := v_reputation_signals + 1;
    v_signal_details := v_signal_details || jsonb_build_array('is_lakefront');
  END IF;
  
  -- Check for current hooks (within expiry and is_current = true)
  SELECT 
    COUNT(*) > 0,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'headline', headline,
      'hook_type', hook_type,
      'published_at', published_at
    )), '[]'::jsonb)
  INTO v_has_current_hook, v_current_hooks
  FROM restaurant_news
  WHERE restaurant_id = p_restaurant_id
    AND is_current = true
    AND (expires_at IS NULL OR expires_at > now())
    AND hook_type IS NOT NULL;
  
  RETURN jsonb_build_object(
    'eligible', v_reputation_signals >= 2 AND v_has_current_hook,
    'restaurant_name', v_restaurant.name,
    'reputation_signals', v_reputation_signals,
    'signal_details', v_signal_details,
    'has_current_hook', v_has_current_hook,
    'current_hooks', v_current_hooks,
    'gate1_passed', v_reputation_signals >= 2,
    'gate2_passed', v_has_current_hook
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create scheduled function to expire old news
CREATE OR REPLACE FUNCTION public.expire_old_restaurant_news()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE restaurant_news 
  SET is_current = false
  WHERE is_current = true 
    AND expires_at IS NOT NULL 
    AND expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add index for efficient hook lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_news_current_hooks 
ON restaurant_news(restaurant_id, is_current, expires_at) 
WHERE is_current = true;
