import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

const sendInvoiceEmail = async (
  resend: Resend,
  to: string,
  businessName: string,
  invoiceNumber: string,
  amount: number,
  description: string,
  dueDate: string,
  paymentUrl: string
) => {
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegenevascoop.com";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Lake Geneva Scoop</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Invoice</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin-top: 0;">Hello ${businessName},</p>
        
        <p>Thank you for choosing to advertise with Lake Geneva Scoop! Please find your invoice details below:</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Description:</td>
              <td style="padding: 8px 0; text-align: right;">${description}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Due Date:</td>
              <td style="padding: 8px 0; text-align: right;">${new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
            </tr>
            <tr style="border-top: 2px solid #e9ecef;">
              <td style="padding: 16px 0 8px; font-weight: 600; font-size: 18px;">Amount Due:</td>
              <td style="padding: 16px 0 8px; text-align: right; font-weight: 700; font-size: 24px; color: #1e3a5f;">${formatCurrency(amount)}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${paymentUrl}" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Pay Now</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">If you have any questions about this invoice, please reply to this email or contact us at hello@lakegenevascoop.com.</p>
        
        <p style="margin-bottom: 0;">Best regards,<br><strong>Lake Geneva Scoop Team</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p style="margin: 0;">Lake Geneva Scoop • Your Local News Source</p>
        <p style="margin: 5px 0 0 0;"><a href="${appBaseUrl}" style="color: #666;">lakegenevascoop.com</a></p>
      </div>
    </body>
    </html>
  `;

  return await resend.emails.send({
    from: "Lake Geneva Scoop <billing@lakegenevascoop.com>",
    to: [to],
    subject: `Invoice ${invoiceNumber} from Lake Geneva Scoop`,
    html,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;

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
    let dueDate: string | null = null;

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
      dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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
          due_date: dueDate,
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

    // Send invoice email if we have an email and resend is configured
    if (resend && business.email && invoiceNumber && dueDate) {
      try {
        await sendInvoiceEmail(
          resend,
          business.email,
          business.name,
          invoiceNumber,
          packageInfo.amount_cents,
          packageInfo.description,
          dueDate,
          session.url || `${origin}/dashboard/sponsors`
        );
        logStep("Invoice email sent", { to: business.email });
      } catch (emailError) {
        logStep("Failed to send invoice email", { error: emailError instanceof Error ? emailError.message : emailError });
        // Don't fail the whole request if email fails
      }
    }

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
