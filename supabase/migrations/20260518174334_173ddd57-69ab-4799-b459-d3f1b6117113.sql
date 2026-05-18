
-- ============================================================
-- RLS hardening
-- ============================================================

-- incidents: drop public UPDATE, allow admins + service_role only (service role bypasses RLS already)
DROP POLICY IF EXISTS "System can update incidents" ON public.incidents;

-- subscribers: drop public UPDATE
DROP POLICY IF EXISTS "System can update unsubscribe status" ON public.subscribers;

-- sponsor_invoices: drop public INSERT/UPDATE
DROP POLICY IF EXISTS "System can update invoices" ON public.sponsor_invoices;
DROP POLICY IF EXISTS "System can insert invoices" ON public.sponsor_invoices;

-- restaurant_news: drop overly-permissive ALL policy
DROP POLICY IF EXISTS "Service can manage restaurant news" ON public.restaurant_news;

-- restaurant_pages: drop public ALL policy
DROP POLICY IF EXISTS "System full access to pages" ON public.restaurant_pages;

-- restaurant_reviews: drop public ALL policy
DROP POLICY IF EXISTS "Service can manage restaurant reviews" ON public.restaurant_reviews;

-- restaurant_scrape_jobs: drop public ALL policy
DROP POLICY IF EXISTS "Service role full access" ON public.restaurant_scrape_jobs;

-- Add admin-management policies so admins keep CRUD via dashboard;
-- service role continues to bypass RLS automatically.
CREATE POLICY "Admins can manage restaurant news"
  ON public.restaurant_news FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage restaurant pages"
  ON public.restaurant_pages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage restaurant reviews"
  ON public.restaurant_reviews FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage restaurant scrape jobs"
  ON public.restaurant_scrape_jobs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- fish_fry_submissions: add admin-only SELECT to protect PII
DROP POLICY IF EXISTS "Admins can view submissions" ON public.fish_fry_submissions;
CREATE POLICY "Admins can view submissions"
  ON public.fish_fry_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin'::app_role, 'moderator'::app_role)
    )
  );

-- ============================================================
-- Token tables: drop public SELECT, replace with security-definer RPCs
-- ============================================================

DROP POLICY IF EXISTS "System can read tokens" ON public.employer_access_tokens;
DROP POLICY IF EXISTS "System can insert tokens" ON public.employer_access_tokens;
DROP POLICY IF EXISTS "System can update tokens" ON public.employer_access_tokens;

DROP POLICY IF EXISTS "System can read tokens" ON public.sponsor_access_tokens;
DROP POLICY IF EXISTS "System can insert tokens" ON public.sponsor_access_tokens;
DROP POLICY IF EXISTS "System can update tokens" ON public.sponsor_access_tokens;

-- (Admin-manage policies on both tables remain in place; service_role bypasses RLS.)

CREATE OR REPLACE FUNCTION public.validate_employer_token(_token text)
RETURNS TABLE(email text, expires_at timestamptz, used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.email, t.expires_at, t.used_at
  FROM public.employer_access_tokens t
  WHERE t.token = _token
    AND t.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mark_employer_token_used(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employer_access_tokens
  SET used_at = now()
  WHERE token = _token
    AND expires_at > now()
    AND used_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_sponsor_token(_token text)
RETURNS TABLE(
  email text,
  business_id uuid,
  expires_at timestamptz,
  used_at timestamptz,
  business_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.email, t.business_id, t.expires_at, t.used_at, bp.name
  FROM public.sponsor_access_tokens t
  LEFT JOIN public.business_profiles bp ON bp.id = t.business_id
  WHERE t.token = _token
    AND t.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mark_sponsor_token_used(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sponsor_access_tokens
  SET used_at = now()
  WHERE token = _token
    AND expires_at > now()
    AND used_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_employer_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_employer_token_used(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_sponsor_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_sponsor_token_used(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_employer_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_employer_token_used(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_sponsor_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_sponsor_token_used(text) TO anon, authenticated;

-- ============================================================
-- Employer email preferences: drop public read/update, expose via token-gated RPCs
-- ============================================================

DROP POLICY IF EXISTS "Allow public read for unsubscribe" ON public.employer_email_preferences;
DROP POLICY IF EXISTS "Allow public update for preferences" ON public.employer_email_preferences;
-- Keep INSERT policy as-is (still required for upsert from token-gated RPC fallback)

-- Admin SELECT
DROP POLICY IF EXISTS "Admins can view email preferences" ON public.employer_email_preferences;
CREATE POLICY "Admins can view email preferences"
  ON public.employer_email_preferences FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_employer_preferences(_token text)
RETURNS TABLE(email text, weekly_digest boolean, expiry_reminders boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT t.email INTO _email
  FROM public.employer_access_tokens t
  WHERE t.token = _token AND t.expires_at > now()
  LIMIT 1;

  IF _email IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.email, p.weekly_digest, p.expiry_reminders
    FROM public.employer_email_preferences p
    WHERE p.email = lower(_email)
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employer_preference(_token text, _field text, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF _field NOT IN ('weekly_digest', 'expiry_reminders') THEN
    RAISE EXCEPTION 'Invalid preference field';
  END IF;

  SELECT t.email INTO _email
  FROM public.employer_access_tokens t
  WHERE t.token = _token AND t.expires_at > now()
  LIMIT 1;

  IF _email IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  IF _field = 'weekly_digest' THEN
    INSERT INTO public.employer_email_preferences (email, weekly_digest, expiry_reminders)
    VALUES (lower(_email), _value, true)
    ON CONFLICT (email) DO UPDATE
      SET weekly_digest = _value, updated_at = now();
  ELSE
    INSERT INTO public.employer_email_preferences (email, weekly_digest, expiry_reminders)
    VALUES (lower(_email), true, _value)
    ON CONFLICT (email) DO UPDATE
      SET expiry_reminders = _value, updated_at = now();
  END IF;
END;
$$;

-- Ensure ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS employer_email_preferences_email_key
  ON public.employer_email_preferences (email);

REVOKE ALL ON FUNCTION public.get_employer_preferences(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_employer_preference(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_preferences(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_employer_preference(text, text, boolean) TO anon, authenticated;
