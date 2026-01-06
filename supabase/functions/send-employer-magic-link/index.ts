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

    // Check if this email has any job listings
    const { data: jobs, error: jobsError } = await supabase
      .from("job_listings")
      .select("id")
      .eq("contact_email", email.toLowerCase())
      .limit(1);

    if (jobsError) {
      console.error("Error checking jobs:", jobsError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobs || jobs.length === 0) {
      // Don't reveal if email exists - just say link sent for security
      return new Response(
        JSON.stringify({ success: true, message: "If you have job listings, a link will be sent to your email." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new access token
    const { data: tokenData, error: tokenError } = await supabase
      .from("employer_access_tokens")
      .insert({ email: email.toLowerCase() })
      .select("token")
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to create access link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dashboardUrl = `${appBaseUrl}/employer-dashboard?token=${tokenData.token}`;

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
        subject: "Access Your Job Listings Dashboard",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Your Employer Dashboard Access</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
              Click the button below to access your job listings dashboard. This link is valid for 7 days.
            </p>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 500;">
              Access Dashboard
            </a>
            <p style="color: #6b6b6b; font-size: 14px; line-height: 1.5;">
              If you didn't request this link, you can safely ignore this email.
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

    console.log("Magic link email sent to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Access link sent to your email." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-employer-magic-link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
