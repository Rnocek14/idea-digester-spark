import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://lakegeneva.news";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple encoding for email in URL (base64)
function decodeEmail(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return "";
  }
}

function encodeEmail(email: string): string {
  return btoa(email);
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Handle both GET (from email link) and POST (from form)
  if (req.method === "GET") {
    const encodedEmail = url.searchParams.get("e");
    const type = url.searchParams.get("type") || "weekly_digest";
    const action = url.searchParams.get("action") || "unsubscribe";
    
    if (!encodedEmail) {
      return new Response(renderPage("Error", "Invalid unsubscribe link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const email = decodeEmail(encodedEmail);
    if (!email || !email.includes("@")) {
      return new Response(renderPage("Error", "Invalid email in unsubscribe link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if preferences exist
      const { data: existing } = await supabase
        .from("employer_email_preferences")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      if (action === "unsubscribe") {
        // Upsert preferences with the specific type disabled
        const updates: Record<string, boolean> = {};
        if (type === "weekly_digest") updates.weekly_digest = false;
        if (type === "expiry_reminders") updates.expiry_reminders = false;

        if (existing) {
          await supabase
            .from("employer_email_preferences")
            .update(updates)
            .eq("email", email.toLowerCase());
        } else {
          await supabase
            .from("employer_email_preferences")
            .insert({ email: email.toLowerCase(), ...updates });
        }

        const typeLabel = type === "weekly_digest" ? "weekly performance digest" : "expiry reminder";
        return new Response(renderPage(
          "Unsubscribed",
          `You've been unsubscribed from ${typeLabel} emails.`,
          email,
          true
        ), {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      } else if (action === "resubscribe") {
        const updates: Record<string, boolean> = {};
        if (type === "weekly_digest") updates.weekly_digest = true;
        if (type === "expiry_reminders") updates.expiry_reminders = true;

        if (existing) {
          await supabase
            .from("employer_email_preferences")
            .update(updates)
            .eq("email", email.toLowerCase());
        } else {
          await supabase
            .from("employer_email_preferences")
            .insert({ email: email.toLowerCase(), weekly_digest: true, expiry_reminders: true });
        }

        const typeLabel = type === "weekly_digest" ? "weekly performance digest" : "expiry reminder";
        return new Response(renderPage(
          "Resubscribed",
          `You've been resubscribed to ${typeLabel} emails.`,
          email,
          false
        ), {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(renderPage("Error", "Invalid action."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });

    } catch (err) {
      console.error("employer-unsubscribe error:", err);
      return new Response(renderPage("Error", "Something went wrong. Please try again later."), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

function renderPage(title: string, message: string, email?: string, showResubscribe?: boolean): string {
  const encodedEmail = email ? encodeEmail(email) : "";
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Lake Geneva Brief</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          padding: 40px;
          max-width: 420px;
          text-align: center;
        }
        .icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 28px;
        }
        .icon-success { background: #DCFCE7; }
        .icon-error { background: #FEE2E2; }
        h1 {
          color: #0F172A;
          font-size: 24px;
          margin-bottom: 12px;
        }
        p {
          color: #64748B;
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .btn {
          display: inline-block;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #2563EB;
          color: white;
        }
        .btn-primary:hover { background: #1D4ED8; }
        .btn-secondary {
          background: #F1F5F9;
          color: #475569;
          margin-left: 8px;
        }
        .btn-secondary:hover { background: #E2E8F0; }
        .footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #E2E8F0;
          color: #94A3B8;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon ${title === "Error" ? "icon-error" : "icon-success"}">
          ${title === "Error" ? "❌" : title === "Unsubscribed" ? "📭" : "✅"}
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div>
          <a href="${APP_BASE_URL}" class="btn btn-primary">Back to Site</a>
          ${showResubscribe && email ? `<a href="?e=${encodedEmail}&type=weekly_digest&action=resubscribe" class="btn btn-secondary">Resubscribe</a>` : ""}
        </div>
        <div class="footer">
          Lake Geneva Brief · Local News & Jobs
        </div>
      </div>
    </body>
    </html>
  `;
}
