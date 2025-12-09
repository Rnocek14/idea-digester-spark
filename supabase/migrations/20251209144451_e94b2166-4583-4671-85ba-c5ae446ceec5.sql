-- Create function to update subscriber engagement score
CREATE OR REPLACE FUNCTION public.update_subscriber_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_id uuid;
  open_count integer;
  click_count integer;
  new_score integer;
BEGIN
  -- Get subscriber_id from the new row
  sub_id := NEW.subscriber_id;
  
  -- If no subscriber_id, try to find by email
  IF sub_id IS NULL AND NEW.subscriber_email IS NOT NULL THEN
    SELECT id INTO sub_id FROM subscribers WHERE email = NEW.subscriber_email LIMIT 1;
  END IF;
  
  -- If still no subscriber found, exit
  IF sub_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count opens for this subscriber
  SELECT COUNT(*) INTO open_count
  FROM newsletter_opens
  WHERE subscriber_id = sub_id OR subscriber_email = (SELECT email FROM subscribers WHERE id = sub_id);
  
  -- Count clicks for this subscriber
  SELECT COUNT(*) INTO click_count
  FROM newsletter_clicks
  WHERE subscriber_id = sub_id OR subscriber_email = (SELECT email FROM subscribers WHERE id = sub_id);
  
  -- Calculate score: opens * 1 + clicks * 3
  new_score := (open_count * 1) + (click_count * 3);
  
  -- Update subscriber with new score and last activity timestamps
  IF TG_TABLE_NAME = 'newsletter_opens' THEN
    UPDATE subscribers
    SET 
      engagement_score = new_score,
      last_opened_at = NEW.opened_at,
      updated_at = now()
    WHERE id = sub_id;
  ELSIF TG_TABLE_NAME = 'newsletter_clicks' THEN
    UPDATE subscribers
    SET 
      engagement_score = new_score,
      last_clicked_at = NEW.clicked_at,
      updated_at = now()
    WHERE id = sub_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for newsletter_opens
DROP TRIGGER IF EXISTS trigger_update_engagement_on_open ON newsletter_opens;
CREATE TRIGGER trigger_update_engagement_on_open
AFTER INSERT ON newsletter_opens
FOR EACH ROW
EXECUTE FUNCTION public.update_subscriber_engagement();

-- Create trigger for newsletter_clicks
DROP TRIGGER IF EXISTS trigger_update_engagement_on_click ON newsletter_clicks;
CREATE TRIGGER trigger_update_engagement_on_click
AFTER INSERT ON newsletter_clicks
FOR EACH ROW
EXECUTE FUNCTION public.update_subscriber_engagement();