import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LEAD_NOTIFY_TO = Deno.env.get("LEAD_NOTIFY_TO") ?? "notifications@citybrief.info";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://mzumvkrpnxhkvhdyzgqa.supabase.co";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JobPayload = {
  id?: string;
  business_name: string;
  title: string;
  category: string;
  job_type: string;
  description: string;
  location_text?: string | null;
  pay_display?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  apply_url?: string | null;
  pricing_tier?: string | null;
  created_at?: string;
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

    console.log("Received job notification request:", job);

    if (!job || !job.business_name || !job.title || !job.contact_email) {
      console.error("Invalid payload:", job);
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }

    const pricingLabel = job.pricing_tier === "featured" ? "Featured ($100)" : "Standard ($50)";
    const subject = `[New Job Posting] ${job.title} at ${job.business_name}`;

    const dashboardUrl = `${APP_BASE_URL}/dashboard/jobs`;

    const createdAt = job.created_at
      ? new Date(job.created_at).toLocaleString()
      : "Just now";

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F172A; border-bottom: 2px solid #16A34A; padding-bottom: 12px;">
          💼 New Job Posting Submitted
        </h2>
        <p style="color: #475569; font-size: 15px;">
          A new job listing has been submitted and is awaiting review.
        </p>

        <div style="background: #F0FDF4; border-left: 4px solid #16A34A; padding: 16px; margin: 20px 0;">
          <h3 style="color: #0F172A; margin-top: 0; font-size: 16px;">Job Details</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 110px;"><strong>Position:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.title}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Business:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.business_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Category:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.category}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Type:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.job_type}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Location:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.location_text || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Pay:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.pay_display || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Pricing Tier:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${pricingLabel}</td>
            </tr>
          </table>
        </div>

        <div style="background: #F8FAFC; border-left: 4px solid #2563EB; padding: 16px; margin: 20px 0;">
          <h3 style="color: #0F172A; margin-top: 0; font-size: 16px;">Contact Info</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 110px;"><strong>Email:</strong></td>
              <td style="padding: 6px 0;"><a href="mailto:${job.contact_email}" style="color: #2563EB;">${job.contact_email}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Phone:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${job.contact_phone || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Apply URL:</strong></td>
              <td style="padding: 6px 0;">
                ${job.apply_url ? `<a href="${job.apply_url}" style="color: #2563EB;">${job.apply_url}</a>` : "—"}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Submitted:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${createdAt}</td>
            </tr>
          </table>
        </div>

        <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0;">
          <h3 style="color: #92400E; margin-top: 0; font-size: 16px;">Job Description</h3>
          <p style="color: #78350F; margin: 0; white-space: pre-wrap; font-size: 14px;">${job.description}</p>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${dashboardUrl}" 
             style="display: inline-block; background: #16A34A; color: white; padding: 12px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600;">
            Review Job Listings
          </a>
        </div>

        <p style="color: #94A3B8; font-size: 12px; margin-top: 40px; text-align: center;">
          Lake Geneva Brief · Job Board Notification
        </p>
      </div>
    `;

    const emailPayload = {
      from: "Lake Geneva Brief <newsletter@citybrief.info>",
      to: [LEAD_NOTIFY_TO],
      subject,
      html,
    };

    console.log("Sending job notification email to:", LEAD_NOTIFY_TO);

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
    console.log("Job notification email sent successfully:", result);

    return new Response(JSON.stringify({ ok: true, emailId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-on-job error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
