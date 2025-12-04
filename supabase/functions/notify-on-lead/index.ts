import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LEAD_NOTIFY_TO = Deno.env.get("LEAD_NOTIFY_TO") ?? "notifications@citybrief.info";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://mzumvkrpnxhkvhdyzgqa.supabase.co";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LeadPayload = {
  id?: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string;
  sponsor_name?: string | null;
  sponsor_email?: string | null;
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
    const lead: LeadPayload = body.lead;

    console.log("Received lead notification request:", lead);

    if (!lead || !lead.business_name || !lead.email) {
      console.error("Invalid payload:", lead);
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }

    const source =
      lead.source === "advertise_page"
        ? "Advertise page"
        : lead.source === "directory"
        ? "Directory"
        : lead.source === "manual"
        ? "Manual"
        : lead.source === "market_analysis"
        ? `Market Analysis Request${lead.sponsor_name ? ` for ${lead.sponsor_name}` : ""}`
        : lead.source || "Unknown";

    const isMarketAnalysis = lead.source === "market_analysis";
    const subject = isMarketAnalysis
      ? `[Market Analysis Request] ${lead.contact_name} wants a home value report`
      : `[New Advertiser Lead] ${lead.business_name} (${source})`;

    const dashboardUrl = lead.id
      ? `${APP_BASE_URL}/dashboard/leads?leadId=${lead.id}`
      : `${APP_BASE_URL}/dashboard/leads`;

    const createdAt = lead.created_at
      ? new Date(lead.created_at).toLocaleString()
      : "Just now";

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F172A; border-bottom: 2px solid #2563EB; padding-bottom: 12px;">
          New Advertiser Lead
        </h2>
        <p style="color: #475569; font-size: 15px;">
          You just received a new advertiser lead from <strong>${source}</strong>.
        </p>

        <div style="background: #F8FAFC; border-left: 4px solid #2563EB; padding: 16px; margin: 20px 0;">
          <h3 style="color: #0F172A; margin-top: 0; font-size: 16px;">Business Details</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 100px;"><strong>Business:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${lead.business_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Contact:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${lead.contact_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Email:</strong></td>
              <td style="padding: 6px 0;"><a href="mailto:${lead.email}" style="color: #2563EB;">${lead.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Phone:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${lead.phone || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Website:</strong></td>
              <td style="padding: 6px 0;">
                ${lead.website ? `<a href="${lead.website}" style="color: #2563EB;">${lead.website}</a>` : "—"}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Source:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${source}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B;"><strong>Created:</strong></td>
              <td style="padding: 6px 0; color: #0F172A;">${createdAt}</td>
            </tr>
          </table>
        </div>

        ${
          lead.notes
            ? `
          <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0;">
            <h3 style="color: #92400E; margin-top: 0; font-size: 16px;">Notes / Goals</h3>
            <p style="color: #78350F; margin: 0; white-space: pre-wrap;">${lead.notes}</p>
          </div>
        `
            : ""
        }

        <div style="margin-top: 30px; text-align: center;">
          <a href="${dashboardUrl}" 
             style="display: inline-block; background: #2563EB; color: white; padding: 12px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600;">
            Open Leads Dashboard
          </a>
        </div>

        <p style="color: #94A3B8; font-size: 12px; margin-top: 40px; text-align: center;">
          Lake Geneva Brief · Advertiser Lead Notification
        </p>
      </div>
    `;

    // Build recipient list - include sponsor for market analysis requests
    const recipients = [LEAD_NOTIFY_TO];
    if (isMarketAnalysis && lead.sponsor_email) {
      recipients.push(lead.sponsor_email);
    }

    const emailPayload = {
      from: "Lake Geneva Brief <newsletter@citybrief.info>",
      to: recipients,
      subject,
      html,
    };

    console.log("Sending email to:", LEAD_NOTIFY_TO);

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
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ ok: true, emailId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-on-lead error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
