import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://lakegeneva.news";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JobPayload = {
  id: string;
  business_name: string;
  title: string;
  contact_email: string;
  rejection_reason?: string;
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const job: JobPayload = body.job;

    console.log("Received job rejection notification request:", job);

    if (!job || !job.business_name || !job.title || !job.contact_email) {
      console.error("Invalid payload:", job);
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }

    const resubmitUrl = `${APP_BASE_URL}/post-job`;
    const contactUrl = `${APP_BASE_URL}/advertise`;

    const rejectionReason = job.rejection_reason || "The listing did not meet our community guidelines.";

    const subject = `Update on your job listing "${job.title}"`;

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Hi <strong>${job.business_name}</strong>,
        </p>
        
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Thank you for submitting your job listing to Lake Geneva Brief. After reviewing your submission, we were unable to approve it at this time.
        </p>

        <div style="background: #FEF2F2; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #FECACA;">
          <h3 style="color: #991B1B; margin: 0 0 12px 0; font-size: 16px;">Listing Details</h3>
          <p style="color: #B91C1C; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">${job.title}</p>
          
          <h4 style="color: #991B1B; margin: 0 0 8px 0; font-size: 14px;">Reason:</h4>
          <p style="color: #7F1D1D; margin: 0; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
        </div>

        <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="color: #334155; margin: 0 0 8px 0; font-size: 14px;">What you can do:</h4>
          <ul style="color: #64748B; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.6;">
            <li>Review the feedback above and update your listing</li>
            <li>Resubmit with the necessary changes</li>
            <li>Contact us if you have questions</li>
          </ul>
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${resubmitUrl}" 
             style="display: inline-block; background: #2563EB; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
            Submit a New Listing
          </a>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 30px;">
          <p style="color: #64748B; font-size: 14px; margin: 0;">
            Have questions? <a href="${contactUrl}" style="color: #2563EB;">Contact our team</a> and we'll be happy to help.
          </p>
        </div>

        <p style="color: #94A3B8; font-size: 12px; margin-top: 40px; text-align: center;">
          Lake Geneva Brief · Local Jobs Board<br/>
          <a href="${APP_BASE_URL}" style="color: #94A3B8;">lakegeneva.news</a>
        </p>
      </div>
    `;

    const emailPayload = {
      from: "Lake Geneva Brief <newsletter@citybrief.info>",
      to: [job.contact_email],
      subject,
      html,
    };

    console.log("Sending job rejection notification to:", job.contact_email);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Resend error:", text);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await resp.json();
    console.log("Job rejection notification sent successfully:", result);

    return new Response(JSON.stringify({ ok: true, emailId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-job-rejected error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
