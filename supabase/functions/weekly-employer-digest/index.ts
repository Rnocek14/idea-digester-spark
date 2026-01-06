import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://lakegeneva.news";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobListing {
  id: string;
  title: string;
  business_name: string;
  contact_email: string;
  status: string;
  expires_at: string;
  is_featured: boolean;
}

interface ClickStats {
  total: number;
  website: number;
  newsletter: number;
  thisWeek: number;
  lastWeek: number;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lake Geneva Brief <newsletter@citybrief.info>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Failed to send email to ${to}:`, text);
      return false;
    }
    
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (err) {
    console.error(`Error sending email to ${to}:`, err);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active job listings
    const { data: jobs, error: jobsError } = await supabase
      .from("job_listings")
      .select("id, title, business_name, contact_email, status, expires_at, is_featured")
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString());

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No active job listings found");
      return new Response(JSON.stringify({ message: "No active jobs to process" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group jobs by employer email
    const employerJobs: Record<string, JobListing[]> = {};
    jobs.forEach((job: JobListing) => {
      const email = job.contact_email.toLowerCase();
      if (!employerJobs[email]) {
        employerJobs[email] = [];
      }
      employerJobs[email].push(job);
    });

    // Calculate date ranges
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 14);

    // Fetch all clicks for active jobs
    const jobIds = jobs.map((j: JobListing) => j.id);
    const { data: allClicks, error: clicksError } = await supabase
      .from("job_clicks")
      .select("job_id, source, clicked_at")
      .in("job_id", jobIds)
      .gte("clicked_at", lastWeekStart.toISOString());

    if (clicksError) {
      console.error("Error fetching clicks:", clicksError);
    }

    // Process clicks by job
    const clicksByJob: Record<string, ClickStats> = {};
    jobIds.forEach((id: string) => {
      clicksByJob[id] = { total: 0, website: 0, newsletter: 0, thisWeek: 0, lastWeek: 0 };
    });

    if (allClicks) {
      allClicks.forEach((click: { job_id: string; source: string; clicked_at: string }) => {
        const stats = clicksByJob[click.job_id];
        if (!stats) return;

        stats.total++;
        if (click.source === "newsletter") {
          stats.newsletter++;
        } else {
          stats.website++;
        }

        const clickDate = new Date(click.clicked_at);
        if (clickDate >= thisWeekStart) {
          stats.thisWeek++;
        } else {
          stats.lastWeek++;
        }
      });
    }

    // Send digest to each employer
    let sent = 0;
    let failed = 0;

    for (const [email, employerJobList] of Object.entries(employerJobs)) {
      const businessName = employerJobList[0].business_name;
      
      // Calculate totals for this employer
      let totalClicksThisWeek = 0;
      let totalClicksLastWeek = 0;
      
      employerJobList.forEach(job => {
        const stats = clicksByJob[job.id];
        if (stats) {
          totalClicksThisWeek += stats.thisWeek;
          totalClicksLastWeek += stats.lastWeek;
        }
      });

      // Calculate trend
      const trend = totalClicksLastWeek > 0 
        ? Math.round(((totalClicksThisWeek - totalClicksLastWeek) / totalClicksLastWeek) * 100)
        : totalClicksThisWeek > 0 ? 100 : 0;
      
      const trendText = trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : "No change";
      const trendColor = trend > 0 ? "#16A34A" : trend < 0 ? "#DC2626" : "#64748B";

      // Build job rows HTML
      const jobRows = employerJobList.map(job => {
        const stats = clicksByJob[job.id] || { total: 0, thisWeek: 0, website: 0, newsletter: 0 };
        const daysLeft = Math.ceil((new Date(job.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expiryColor = daysLeft <= 3 ? "#DC2626" : daysLeft <= 7 ? "#F59E0B" : "#16A34A";
        
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
              <div style="font-weight: 600; color: #0F172A;">${job.title}</div>
              ${job.is_featured ? '<span style="background: #FEF3C7; color: #92400E; font-size: 11px; padding: 2px 6px; border-radius: 4px;">Featured</span>' : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">
              <div style="font-weight: 600; color: #7C3AED;">${stats.thisWeek}</div>
              <div style="font-size: 11px; color: #64748B;">this week</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">
              <div style="font-size: 13px; color: #64748B;">
                🌐 ${stats.website} · 📧 ${stats.newsletter}
              </div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right;">
              <span style="color: ${expiryColor}; font-weight: 500;">${daysLeft} days</span>
            </td>
          </tr>
        `;
      }).join("");

      const dashboardUrl = `${APP_BASE_URL}/employer`;
      const postJobUrl = `${APP_BASE_URL}/post-job`;

      const html = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0F172A; margin: 0; font-size: 24px;">📊 Weekly Job Performance</h1>
            <p style="color: #64748B; margin: 8px 0 0 0;">Hi ${businessName}, here's how your listings performed this week</p>
          </div>

          <!-- Summary Stats -->
          <div style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <div style="display: inline-block; margin: 0 20px;">
              <div style="font-size: 32px; font-weight: 700; color: #0369A1;">${totalClicksThisWeek}</div>
              <div style="font-size: 13px; color: #64748B;">Clicks This Week</div>
            </div>
            <div style="display: inline-block; margin: 0 20px;">
              <div style="font-size: 24px; font-weight: 600; color: ${trendColor};">${trendText}</div>
              <div style="font-size: 13px; color: #64748B;">vs Last Week</div>
            </div>
            <div style="display: inline-block; margin: 0 20px;">
              <div style="font-size: 32px; font-weight: 700; color: #0F172A;">${employerJobList.length}</div>
              <div style="font-size: 13px; color: #64748B;">Active Listings</div>
            </div>
          </div>

          <!-- Job Performance Table -->
          <div style="background: white; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #F8FAFC;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px;">Job Title</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px;">Clicks</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px;">Sources</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px;">Expires</th>
                </tr>
              </thead>
              <tbody>
                ${jobRows}
              </tbody>
            </table>
          </div>

          <!-- Tips Section -->
          <div style="background: #FFFBEB; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #92400E; margin: 0 0 8px 0; font-size: 14px;">💡 Tips to Get More Clicks</h3>
            <ul style="color: #78350F; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
              <li>Featured listings get 3x more visibility</li>
              <li>Add competitive pay info to attract candidates</li>
              <li>Renew before expiring to maintain momentum</li>
            </ul>
          </div>

          <!-- CTAs -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" 
               style="display: inline-block; background: #2563EB; color: white; padding: 12px 28px; 
                      text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 12px;">
              View Dashboard
            </a>
            <a href="${postJobUrl}" 
               style="display: inline-block; background: white; color: #2563EB; padding: 12px 28px; 
                      text-decoration: none; border-radius: 8px; font-weight: 600; border: 2px solid #2563EB;">
              Post Another Job
            </a>
          </div>

          <p style="color: #94A3B8; font-size: 12px; text-align: center; margin-top: 40px;">
            Lake Geneva Brief · Local Jobs Board<br/>
            <a href="${APP_BASE_URL}" style="color: #94A3B8;">lakegeneva.news</a>
          </p>
        </div>
      `;

      const subject = `📊 Your weekly job performance: ${totalClicksThisWeek} clicks this week`;
      
      const success = await sendEmail(email, subject, html);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    console.log(`Weekly digest complete: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent, 
      failed,
      employers: Object.keys(employerJobs).length 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("weekly-employer-digest error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
