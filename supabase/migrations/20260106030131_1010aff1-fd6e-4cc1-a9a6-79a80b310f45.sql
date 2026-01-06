-- Create table to store employer magic link tokens
CREATE TABLE public.employer_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone
);

-- Create index for token lookups
CREATE INDEX idx_employer_tokens_token ON public.employer_access_tokens(token);
CREATE INDEX idx_employer_tokens_email ON public.employer_access_tokens(email);

-- Enable RLS
ALTER TABLE public.employer_access_tokens ENABLE ROW LEVEL SECURITY;

-- System can insert tokens (for edge function)
CREATE POLICY "System can insert tokens"
ON public.employer_access_tokens
FOR INSERT
WITH CHECK (true);

-- System can read tokens (for validation)
CREATE POLICY "System can read tokens"
ON public.employer_access_tokens
FOR SELECT
USING (true);

-- System can update tokens (mark as used)
CREATE POLICY "System can update tokens"
ON public.employer_access_tokens
FOR UPDATE
USING (true);

-- Admins can manage all tokens
CREATE POLICY "Admins can manage tokens"
ON public.employer_access_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));