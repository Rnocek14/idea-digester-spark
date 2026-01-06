import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lake Geneva Brief <jobs@lakegeneva.news>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find jobs expiring in exactly 3 days
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Create date range for "3 days from now" (the entire day)
    const startOfDay = new Date(threeDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(threeDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Checking for jobs expiring between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const { data: expiringJobs, error: jobsError } = await supabase
      .from("job_listings")
      .select("id, title, business_name, contact_email, expires_at")
      .eq("status", "approved")
      .gte("expires_at", startOfDay.toISOString())
      .lte("expires_at", endOfDay.toISOString());

    if (jobsError) {
      console.error("Error fetching expiring jobs:", jobsError);
      throw jobsError;
    }

    console.log(`Found ${expiringJobs?.length || 0} jobs expiring in 3 days`);

    if (!expiringJobs || expiringJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No jobs expiring in 3 days", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegeneva.news";
    let sentCount = 0;
    const errors: string[] = [];

    for (const job of expiringJobs) {
      try {
        const expiresDate = new Date(job.expires_at).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Job Listing Expiring Soon</h2>
            
            <p>Hi there,</p>
            
            <p>Your job listing on Lake Geneva Brief is expiring soon:</p>
            
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">${job.title}</h3>
              <p style="margin: 0; color: #666;">${job.business_name}</p>
              <p style="margin: 8px 0 0 0; color: #dc2626; font-weight: 500;">
                Expires: ${expiresDate}
              </p>
            </div>
            
            <p>Want to keep your listing active? You can renew it from your Employer Dashboard:</p>
            
            <p style="margin: 24px 0;">
              <a href="${appBaseUrl}/employer-dashboard" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Employer Dashboard
              </a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you no longer need this listing, no action is required—it will automatically expire.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            
            <p style="color: #999; font-size: 12px;">
              Lake Geneva Brief — Local news for the Lake Geneva area<br />
              <a href="${appBaseUrl}" style="color: #2563eb;">lakegeneva.news</a>
            </p>
          </div>
        `;

        const emailResponse = await sendEmail(
          job.contact_email,
          `Your job listing "${job.title}" expires in 3 days`,
          html
        );

        console.log(`Email sent to ${job.contact_email} for job ${job.id}:`, emailResponse);
        sentCount++;
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`Failed to send email for job ${job.id}:`, emailError);
        errors.push(`Job ${job.id}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${expiringJobs.length} expiring jobs`,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in notify-expiring-jobs:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
