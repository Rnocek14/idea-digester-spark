import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SPONSOR-CHECKOUT] ${step}${detailsStr}`);
};

// Price mapping for sponsor ad packages
const PRICE_MAPPING: Record<string, { price_id: string; amount_cents: number; description: string; months: number }> = {
  "newsletter_1mo": {
    price_id: "price_1SmaokLyeUr9eYfBMa1d36Ck",
    amount_cents: 29900,
    description: "Newsletter Banner Ad - 1 Month",
    months: 1,
  },
  "newsletter_3mo": {
    price_id: "price_1SmaozLyeUr9eYfBsUs2PBw7",
    amount_cents: 79900,
    description: "Newsletter Banner Ad - 3 Months",
    months: 3,
  },
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

    const { business_id, package_id, placement_id, invoice_id } = await req.json();
    logStep("Request received", { business_id, package_id, placement_id, invoice_id });

    if (!business_id || !package_id) {
      throw new Error("Missing required fields: business_id and package_id");
    }

    const packageInfo = PRICE_MAPPING[package_id];
    if (!packageInfo) {
      throw new Error(`Invalid package_id: ${package_id}`);
    }

    // Get business info
    const { data: business, error: bizError } = await supabase
      .from("business_profiles")
      .select("name, email")
      .eq("id", business_id)
      .single();

    if (bizError || !business) {
      throw new Error("Business not found");
    }
    logStep("Business found", { name: business.name, email: business.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    let customerId: string | undefined;
    if (business.email) {
      const customers = await stripe.customers.list({ email: business.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { customerId });
      }
    }

    // Generate invoice number if we need to create an invoice record
    let invoiceNumber: string | null = null;
    let invoiceIdToUse = invoice_id;

    if (!invoiceIdToUse) {
      // Generate invoice number
      const { data: invNumData, error: invNumError } = await supabase.rpc("generate_invoice_number");
      
      if (invNumError) {
        // Fallback if RPC fails
        invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      } else {
        invoiceNumber = invNumData;
      }

      // Create invoice record
      const today = new Date();
      const periodEnd = new Date(today);
      periodEnd.setMonth(periodEnd.getMonth() + packageInfo.months);

      const { data: newInvoice, error: invError } = await supabase
        .from("sponsor_invoices")
        .insert({
          business_id,
          placement_id: placement_id || null,
          invoice_number: invoiceNumber,
          description: packageInfo.description,
          amount_cents: packageInfo.amount_cents,
          status: "pending",
          period_start: today.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          due_date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        })
        .select()
        .single();

      if (invError) {
        throw new Error(`Failed to create invoice: ${invError.message}`);
      }
      invoiceIdToUse = newInvoice.id;
      logStep("Created invoice", { invoiceId: invoiceIdToUse, invoiceNumber });
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : business.email || undefined,
      line_items: [
        {
          price: packageInfo.price_id,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard/sponsors?payment=success&invoice_id=${invoiceIdToUse}`,
      cancel_url: `${origin}/dashboard/sponsors?payment=cancelled&invoice_id=${invoiceIdToUse}`,
      metadata: {
        invoice_id: invoiceIdToUse,
        business_id,
        placement_id: placement_id || "",
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update invoice with checkout session ID
    await supabase
      .from("sponsor_invoices")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", invoiceIdToUse);

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        invoice_id: invoiceIdToUse,
        invoice_number: invoiceNumber 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
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
