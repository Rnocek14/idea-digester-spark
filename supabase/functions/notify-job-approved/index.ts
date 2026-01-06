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
  expires_at: string;
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

    console.log("Received job approval notification request:", job);

    if (!job || !job.business_name || !job.title || !job.contact_email) {
      console.error("Invalid payload:", job);
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }

    const expiresDate = new Date(job.expires_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const dashboardUrl = `${APP_BASE_URL}/employer`;
    const jobsPageUrl = `${APP_BASE_URL}/jobs`;

    const subject = `✅ Your job listing "${job.title}" is now live!`;

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #16A34A; margin: 0; font-size: 28px;">🎉 Great News!</h1>
        </div>
        
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Hi <strong>${job.business_name}</strong>,
        </p>
        
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Your job listing has been approved and is now live on Lake Geneva Brief!
        </p>

        <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #BBF7D0;">
          <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 20px;">${job.title}</h2>
          <p style="color: #15803D; margin: 0; font-size: 14px;">at ${job.business_name}</p>
        </div>

        <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #64748B; font-size: 14px; margin: 0;">
            <strong style="color: #334155;">Listing expires:</strong> ${expiresDate}
          </p>
          <p style="color: #64748B; font-size: 13px; margin: 8px 0 0 0;">
            You'll receive a reminder email 3 days before expiration.
          </p>
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${jobsPageUrl}" 
             style="display: inline-block; background: #16A34A; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;
                    box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3);">
            View Your Listing
          </a>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 30px;">
          <p style="color: #64748B; font-size: 14px; margin: 0 0 12px 0;">
            <strong>Manage your listings:</strong>
          </p>
          <p style="margin: 0;">
            <a href="${dashboardUrl}" style="color: #2563EB; font-size: 14px;">
              Access your Employer Dashboard →
            </a>
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

    console.log("Sending job approval notification to:", job.contact_email);

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
    console.log("Job approval notification sent successfully:", result);

    return new Response(JSON.stringify({ ok: true, emailId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-job-approved error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
