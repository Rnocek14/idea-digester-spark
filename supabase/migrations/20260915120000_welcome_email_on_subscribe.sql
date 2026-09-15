-- Welcome email on subscribe.
--
-- Until now a new subscriber heard nothing between signing up and the next
-- morning's brief. This fires `send-welcome-email` the moment the row lands.
--
-- Two properties this trigger must have, and the reason for each:
--
-- 1. IT CAN NEVER BREAK A SIGNUP. An exception raised inside an AFTER INSERT
--    trigger rolls back the INSERT that fired it. If the GUCs are unset, pg_net
--    is missing, or the function is down, a reader trying to subscribe would
--    get an error and no subscription. So every failure path is swallowed and
--    logged as a WARNING: the worst case is a missing welcome email, never a
--    lost subscriber.
--
-- 2. IT SENDS ONCE. `welcome_sent_at` is stamped by the edge function and
--    checked there before sending, so a re-subscribe or a retried request can't
--    mail the same person twice.

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

COMMENT ON COLUMN public.subscribers.welcome_sent_at IS
  'When the one-time welcome email was sent. NULL = never sent. Stamped by the send-welcome-email edge function, which refuses to send when it is already set.';

CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _url text;
BEGIN
  -- Only brand-new active subscribers, and only if they have not been
  -- welcomed already (a re-subscribe can re-insert a row).
  IF COALESCE(NEW.status, 'active') <> 'active' OR NEW.welcome_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    _key := current_setting('app.settings.service_role_key', true);
    _url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      'https://mzumvkrpnxhkvhdyzgqa.supabase.co'
    );

    -- The edge function gates on the service-role key; the anon key would be
    -- rejected. No key configured means no welcome email — never a failed
    -- signup — so say so loudly in the log and move on.
    IF _key IS NULL OR _key = '' THEN
      RAISE WARNING '[send_welcome_email] app.settings.service_role_key is not set; skipping welcome email for subscriber %', NEW.id;
      RETURN NEW;
    END IF;

    -- Only the id travels: the edge function reads the address back itself, so
    -- nothing that reaches an inbox is taken from the caller.
    PERFORM net.http_post(
      url := _url || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
      ),
      body := jsonb_build_object('subscriber_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[send_welcome_email] could not queue welcome email for subscriber %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.subscribers;
CREATE TRIGGER trigger_send_welcome_email
  AFTER INSERT ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email();
