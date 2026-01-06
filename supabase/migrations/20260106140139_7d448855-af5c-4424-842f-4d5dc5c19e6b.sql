-- Create sponsor_invoices table to track billing and payments
CREATE TABLE public.sponsor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement_id UUID REFERENCES public.ad_placements(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on invoice_number
ALTER TABLE public.sponsor_invoices ADD CONSTRAINT sponsor_invoices_invoice_number_unique UNIQUE (invoice_number);

-- Enable RLS
ALTER TABLE public.sponsor_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage invoices"
  ON public.sponsor_invoices
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all invoices"
  ON public.sponsor_invoices
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert invoices"
  ON public.sponsor_invoices
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update invoices"
  ON public.sponsor_invoices
  FOR UPDATE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_sponsor_invoices_updated_at
  BEFORE UPDATE ON public.sponsor_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS sponsor_invoice_number_seq START WITH 1001;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'INV-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('sponsor_invoice_number_seq')::TEXT, 5, '0');
END;
$$;