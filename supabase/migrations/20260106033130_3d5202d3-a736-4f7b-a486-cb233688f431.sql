-- Create employer email preferences table
CREATE TABLE public.employer_email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  weekly_digest BOOLEAN NOT NULL DEFAULT true,
  expiry_reminders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for quick lookups
CREATE INDEX idx_employer_email_preferences_email ON public.employer_email_preferences(email);

-- Enable RLS
ALTER TABLE public.employer_email_preferences ENABLE ROW LEVEL SECURITY;

-- Allow public read/update for unsubscribe functionality (validated by token in edge function)
CREATE POLICY "Allow public read for unsubscribe" 
ON public.employer_email_preferences 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert for preferences" 
ON public.employer_email_preferences 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update for preferences" 
ON public.employer_email_preferences 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_employer_email_preferences_updated_at
BEFORE UPDATE ON public.employer_email_preferences
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();