import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-SPONSOR-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { invoice_id } = await req.json();
    logStep("Request received", { invoice_id });

    if (!invoice_id) {
      throw new Error("Missing invoice_id");
    }

    // Get invoice
    const { data: invoice, error: invError } = await supabase
      .from("sponsor_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      logStep("Invoice already paid");
      return new Response(
        JSON.stringify({ status: "paid", invoice }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice.stripe_checkout_session_id) {
      throw new Error("No checkout session associated with this invoice");
    }

    // Check Stripe session status
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);
    
    logStep("Stripe session status", { status: session.payment_status });

    if (session.payment_status === "paid") {
      // Update invoice to paid
      const { error: updateError } = await supabase
        .from("sponsor_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq("id", invoice_id);

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      // If there's a placement, extend it based on period_end
      if (invoice.placement_id && invoice.period_end) {
        const { error: placementError } = await supabase
          .from("ad_placements")
          .update({
            end_date: invoice.period_end,
            status: "active",
          })
          .eq("id", invoice.placement_id);

        if (placementError) {
          logStep("Warning: Failed to update placement", { error: placementError.message });
        } else {
          logStep("Placement extended", { placement_id: invoice.placement_id, end_date: invoice.period_end });
        }
      }

      logStep("Invoice marked as paid");
      return new Response(
        JSON.stringify({ status: "paid", invoice: { ...invoice, status: "paid" } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: invoice.status, invoice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
