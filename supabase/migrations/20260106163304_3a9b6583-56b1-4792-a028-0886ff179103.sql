-- Create table to store sponsor magic link tokens
CREATE TABLE public.sponsor_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone
);

-- Create index for token lookups
CREATE INDEX idx_sponsor_access_tokens_token ON public.sponsor_access_tokens(token);
CREATE INDEX idx_sponsor_access_tokens_email ON public.sponsor_access_tokens(email);

-- Enable RLS
ALTER TABLE public.sponsor_access_tokens ENABLE ROW LEVEL SECURITY;

-- System can insert tokens (for edge function)
CREATE POLICY "System can insert tokens"
ON public.sponsor_access_tokens
FOR INSERT
WITH CHECK (true);

-- System can read tokens (for validation)
CREATE POLICY "System can read tokens"
ON public.sponsor_access_tokens
FOR SELECT
USING (true);

-- System can update tokens (mark as used)
CREATE POLICY "System can update tokens"
ON public.sponsor_access_tokens
FOR UPDATE
USING (true);

-- Admins can manage all tokens
CREATE POLICY "Admins can manage tokens"
ON public.sponsor_access_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));