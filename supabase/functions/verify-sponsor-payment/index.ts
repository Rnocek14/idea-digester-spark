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
  console.log(`[VERIFY-SPONSOR-PAYMENT] ${step}${detailsStr}`);
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

const sendReceiptEmail = async (
  resend: Resend,
  to: string,
  businessName: string,
  invoiceNumber: string,
  amount: number,
  description: string,
  paidAt: string
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
      <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px;">✓</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">${formatCurrency(amount)}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin-top: 0;">Hello ${businessName},</p>
        
        <p>Thank you for your payment! This email confirms that we have received your payment for advertising with Lake Geneva Scoop.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Receipt Number:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Description:</td>
              <td style="padding: 8px 0; text-align: right;">${description}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Payment Date:</td>
              <td style="padding: 8px 0; text-align: right;">${new Date(paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
            </tr>
            <tr style="border-top: 2px solid #e9ecef;">
              <td style="padding: 16px 0 8px; font-weight: 600; font-size: 18px;">Amount Paid:</td>
              <td style="padding: 16px 0 8px; text-align: right; font-weight: 700; font-size: 24px; color: #16a34a;">${formatCurrency(amount)}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-size: 14px;"><strong>What's next?</strong> Your ad placement is now active! You can view your ad performance in your sponsor dashboard.</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">Please save this email for your records. If you have any questions, please reply to this email or contact us at hello@lakegenevascoop.com.</p>
        
        <p style="margin-bottom: 0;">Thank you for your business!<br><strong>Lake Geneva Scoop Team</strong></p>
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
    subject: `Payment Receipt - ${invoiceNumber}`,
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

    const { invoice_id } = await req.json();
    logStep("Request received", { invoice_id });

    if (!invoice_id) {
      throw new Error("Missing invoice_id");
    }

    // Get invoice with business info
    const { data: invoice, error: invError } = await supabase
      .from("sponsor_invoices")
      .select("*, business_profiles(name, email)")
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
      const paidAt = new Date().toISOString();
      
      // Update invoice to paid
      const { error: updateError } = await supabase
        .from("sponsor_invoices")
        .update({
          status: "paid",
          paid_at: paidAt,
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

      // Send receipt email
      const business = invoice.business_profiles as { name: string; email: string | null } | null;
      if (resend && business?.email) {
        try {
          await sendReceiptEmail(
            resend,
            business.email,
            business.name,
            invoice.invoice_number,
            invoice.amount_cents,
            invoice.description || "Ad Placement",
            paidAt
          );
          logStep("Receipt email sent", { to: business.email });
        } catch (emailError) {
          logStep("Failed to send receipt email", { error: emailError instanceof Error ? emailError.message : emailError });
          // Don't fail the whole request if email fails
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
