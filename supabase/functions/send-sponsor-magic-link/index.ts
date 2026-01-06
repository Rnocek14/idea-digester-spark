import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MagicLinkRequest {
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: MagicLinkRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegenevamedia.com";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this email has any business profiles (via invoices or direct match)
    const { data: businesses, error: businessError } = await supabase
      .from("business_profiles")
      .select("id, name, email")
      .eq("email", email.toLowerCase())
      .limit(1);

    if (businessError) {
      console.error("Error checking business profiles:", businessError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also check if this email has any invoices
    let businessId: string | null = null;
    let businessName: string | null = null;

    if (businesses && businesses.length > 0) {
      businessId = businesses[0].id;
      businessName = businesses[0].name;
    } else {
      // Check invoices to find related business
      const { data: invoices, error: invoiceError } = await supabase
        .from("sponsor_invoices")
        .select(`
          business_id,
          business:business_profiles(id, name, email)
        `)
        .limit(10);

      if (!invoiceError && invoices) {
        // Find a business that matches or is associated with this email
        for (const invoice of invoices) {
          const business = invoice.business as any;
          if (business && business.email?.toLowerCase() === email.toLowerCase()) {
            businessId = business.id;
            businessName = business.name;
            break;
          }
        }
      }
    }

    if (!businessId) {
      // Don't reveal if email exists - just say link sent for security
      return new Response(
        JSON.stringify({ success: true, message: "If you have a sponsor account, a link will be sent to your email." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new access token
    const { data: tokenData, error: tokenError } = await supabase
      .from("sponsor_access_tokens")
      .insert({ 
        email: email.toLowerCase(),
        business_id: businessId
      })
      .select("token")
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to create access link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const portalUrl = `${appBaseUrl}/sponsor-portal?token=${tokenData.token}`;

    // Send the magic link email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lake Geneva Media <noreply@lakegenevamedia.com>",
        to: [email],
        subject: "Access Your Sponsor Portal",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Your Sponsor Portal Access</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
              Hi${businessName ? ` ${businessName}` : ''}! Click the button below to access your sponsor portal where you can:
            </p>
            <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
              <li>View your active ad placements</li>
              <li>Download and print invoices</li>
              <li>Purchase new advertising packages</li>
              <li>Track your ad performance</li>
            </ul>
            <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 500;">
              Access Sponsor Portal
            </a>
            <p style="color: #6b6b6b; font-size: 14px; line-height: 1.5;">
              This link is valid for 7 days. If you didn't request this link, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
            <p style="color: #9a9a9a; font-size: 12px;">
              Lake Geneva Media • Local News Network
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sponsor magic link email sent to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Access link sent to your email." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-sponsor-magic-link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
