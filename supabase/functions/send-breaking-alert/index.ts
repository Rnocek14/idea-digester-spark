import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_id } = await req.json();

    if (!content_id) {
      throw new Error("content_id is required");
    }

    console.log(`🚨 Sending breaking news alert for content: ${content_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://lakegeneva.news";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Fetch the breaking news content
    const { data: content, error: contentError } = await supabase
      .from("content_queue")
      .select("id, title, summary, content_newsletter, original_url, category")
      .eq("id", content_id)
      .single();

    if (contentError || !content) {
      throw new Error(`Content not found: ${contentError?.message || "Not found"}`);
    }

    console.log(`📰 Breaking story: ${content.title}`);

    // Fetch Supporters+ (referral_count >= 1) who are active
    const { data: supporters, error: supportersError } = await supabase
      .from("subscribers")
      .select("id, email, unsubscribe_token")
      .eq("status", "active")
      .gte("referral_count", 1);

    if (supportersError) {
      throw new Error(`Failed to fetch supporters: ${supportersError.message}`);
    }

    if (!supporters || supporters.length === 0) {
      console.log("⚠️ No supporters found with 1+ referrals");
      return new Response(
        JSON.stringify({ success: true, message: "No supporters to notify", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`👥 Found ${supporters.length} supporters to notify`);

    // Build the email content
    const storyBody = content.content_newsletter || content.summary || "";
    const readMoreLink = content.original_url || `${baseUrl}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #dc2626; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 18px; font-weight: 700;">🚨 BREAKING NEWS — EARLY ACCESS</h1>
    </div>
    
    <div style="background-color: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">
        ⭐ Exclusive for Lake Geneva Local Supporters
      </p>
      
      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
        ${escapeHtml(content.title)}
      </h2>
      
      <div style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 24px;">
        ${escapeHtml(storyBody)}
      </div>
      
      <a href="${readMoreLink}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Read Full Story →
      </a>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="font-size: 13px; color: #666; margin: 0;">
        You're receiving this early access alert because you've referred friends to Lake Geneva Local. Thank you for spreading local news!
      </p>
    </div>
    
    <div style="text-align: center; padding: 16px; font-size: 12px; color: #888;">
      <p style="margin: 0 0 8px 0;">Lake Geneva Local</p>
      <a href="{{UNSUBSCRIBE_URL}}" style="color: #888;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
    `.trim();

    const subject = `🚨 BREAKING: ${content.title}`;

    // Send emails in batches
    const batchSize = 50;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < supporters.length; i += batchSize) {
      const batch = supporters.slice(i, i + batchSize);

      for (const supporter of batch) {
        try {
          const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${supporter.unsubscribe_token}`;
          const personalizedHtml = htmlBody.replace("{{UNSUBSCRIBE_URL}}", unsubscribeUrl);

          const { error: sendError } = await resend.emails.send({
            from: "Lake Geneva Local <breaking@citybrief.info>",
            to: supporter.email,
            subject: subject,
            html: personalizedHtml,
          });

          if (sendError) {
            console.error(`❌ Failed to send to ${supporter.email}:`, sendError);
            errors.push(`${supporter.email}: ${sendError.message}`);
            failed++;
          } else {
            sent++;
          }
        } catch (e: any) {
          console.error(`❌ Error sending to ${supporter.email}:`, e);
          errors.push(`${supporter.email}: ${e.message}`);
          failed++;
        }
      }

      // Rate limiting between batches
      if (i + batchSize < supporters.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update last_breaking_email_at for sent supporters
    if (sent > 0) {
      const sentEmails = supporters
        .filter(s => !errors.some(e => e.startsWith(s.email)))
        .map(s => s.id);

      if (sentEmails.length > 0) {
        await supabase
          .from("subscribers")
          .update({ last_breaking_email_at: new Date().toISOString() })
          .in("id", sentEmails);
      }
    }

    console.log(`✅ Breaking alert sent: ${sent} success, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        content_id,
        title: content.title,
        sent,
        failed,
        total_supporters: supporters.length,
        errors: errors.slice(0, 5), // Return first 5 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Breaking alert error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
