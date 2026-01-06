import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

async function sendReminderEmail(
  to: string,
  businessName: string,
  invoiceNumber: string,
  amountCents: number,
  dueDate: string,
  paymentUrl: string
) {
  const amount = (amountCents / 100).toFixed(2);
  const formattedDueDate = new Date(dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">Payment Reminder</h1>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hello,
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          This is a friendly reminder that your invoice <strong>#${invoiceNumber}</strong> for <strong>${businessName}</strong> is due in 7 days.
        </p>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
              <td style="padding: 8px 0; color: #1a1a1a; text-align: right; font-weight: 600;">#${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Amount Due:</td>
              <td style="padding: 8px 0; color: #1a1a1a; text-align: right; font-weight: 600;">$${amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Due Date:</td>
              <td style="padding: 8px 0; color: #dc2626; text-align: right; font-weight: 600;">${formattedDueDate}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${paymentUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Pay Now
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If you've already made this payment, please disregard this reminder. If you have any questions, please don't hesitate to reach out.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          Lake Geneva Locals • Your local news source
        </p>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "Lake Geneva Locals <billing@resend.dev>",
    to: [to],
    subject: `Payment Reminder: Invoice #${invoiceNumber} due in 7 days`,
    html,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate the date 7 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    console.log(`Looking for invoices due on ${targetDateStr}`);

    // Find unpaid invoices due in exactly 7 days
    const { data: invoices, error: invoicesError } = await supabase
      .from("sponsor_invoices")
      .select(`
        id,
        invoice_number,
        amount_cents,
        due_date,
        stripe_checkout_session_id,
        business:business_profiles!sponsor_invoices_business_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("status", "pending")
      .gte("due_date", targetDateStr)
      .lt("due_date", targetDateStr + "T23:59:59");

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${invoices?.length || 0} invoices due in 7 days`);

    const results: { invoiceNumber: string; success: boolean; error?: string }[] = [];

    for (const invoice of invoices || []) {
      const businessData = invoice.business as unknown;
      const business = Array.isArray(businessData) ? businessData[0] : businessData as { id: string; name: string; email: string } | null;
      
      if (!business?.email) {
        console.log(`Skipping invoice ${invoice.invoice_number} - no business email`);
        results.push({
          invoiceNumber: invoice.invoice_number,
          success: false,
          error: "No business email",
        });
        continue;
      }

      try {
        // Generate payment URL - if we have a checkout session, use Stripe directly
        const baseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegeneva.news";
        const paymentUrl = `${baseUrl}/sponsors?tab=billing`;

        await sendReminderEmail(
          business.email,
          business.name,
          invoice.invoice_number,
          invoice.amount_cents,
          invoice.due_date!,
          paymentUrl
        );

        console.log(`Sent reminder for invoice ${invoice.invoice_number} to ${business.email}`);
        results.push({ invoiceNumber: invoice.invoice_number, success: true });
      } catch (emailError: any) {
        console.error(`Failed to send reminder for ${invoice.invoice_number}:`, emailError);
        results.push({
          invoiceNumber: invoice.invoice_number,
          success: false,
          error: emailError.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} reminders, ${failureCount} failed`,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoice-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
