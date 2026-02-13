import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Subscriber {
  id: string;
  email: string;
  unsubscribe_token: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsletter_id } = await req.json();
    
    if (!newsletter_id) {
      throw new Error("newsletter_id is required");
    }

    console.log(`📧 Sending newsletter ${newsletter_id}...`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch newsletter
    const { data: newsletter, error: fetchError } = await supabase
      .from("newsletters")
      .select("*")
      .eq("id", newsletter_id)
      .single();

    if (fetchError) throw fetchError;
    if (!newsletter) throw new Error("Newsletter not found");

    // Only send if status is 'ready'
    if (newsletter.status !== "ready") {
      throw new Error(`Newsletter status is '${newsletter.status}', can only send 'ready' newsletters`);
    }

    // GUARD: Never send a newsletter with 0 stories
    if (newsletter.story_count === 0 || !newsletter.story_ids || newsletter.story_ids.length === 0) {
      console.log(`⛔ Refusing to send newsletter with 0 stories (story_count=${newsletter.story_count})`);
      
      // Mark as skipped instead
      await supabase
        .from("newsletters")
        .update({ 
          status: "skipped", 
          metadata: { ...(newsletter.metadata || {}), skipped_reason: "zero_stories_send_gate" }
        })
        .eq("id", newsletter_id);
      
      return new Response(
        JSON.stringify({
          success: false,
          newsletter_id,
          message: "Newsletter has 0 stories — send blocked. Marked as skipped.",
          skipped_reason: "zero_stories_send_gate"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Send newsletter
    const { sent, failed } = await sendNewsletterEmail(supabase, newsletter, supabaseUrl);
    
    if (sent > 0) {
      // Update newsletter status to sent
      await supabase
        .from("newsletters")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", newsletter_id);
      
      console.log(`✅ Newsletter sent to ${sent} subscribers (${failed} failed)`);
      
      return new Response(
        JSON.stringify({
          success: true,
          newsletter_id,
          sent_count: sent,
          failed_count: failed,
          message: `Newsletter sent to ${sent} subscribers`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      throw new Error("No emails were sent");
    }

  } catch (error: any) {
    console.error("❌ Send newsletter error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Add tracking pixel to HTML
function addTrackingPixel(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  const trackingPixelUrl = `${baseUrl}/functions/v1/track-open?nid=${newsletterId}&sid=${subscriberId}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;" />`;
  
  // Insert before </body> if exists, otherwise at end
  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${trackingPixel}</body>`);
  }
  return htmlBody + trackingPixel;
}

// Rewrite all links to use click tracking
function rewriteLinksForTracking(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  // Match href="..." or href='...'
  const linkRegex = /href=["']([^"']+)["']/gi;
  
  return htmlBody.replace(linkRegex, (match, url) => {
    // Skip tracking for unsubscribe links, anchors, mailto, tel
    if (url.includes('unsubscribe') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match;
    }
    
    // Build tracking URL
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${baseUrl}/functions/v1/track-click?nid=${newsletterId}&sid=${subscriberId}&url=${encodedUrl}`;
    
    return `href="${trackingUrl}"`;
  });
}

// Send newsletter to subscribers via Resend
async function sendNewsletterEmail(supabase: any, newsletter: any, supabaseUrl: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("❌ RESEND_API_KEY not configured");
    return { sent: 0, failed: 0 };
  }

  const resend = new Resend(resendApiKey);

  // Fetch active subscribers
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active");

  if (subError) {
    console.error("Failed to fetch subscribers:", subError);
    return { sent: 0, failed: 0 };
  }

  if (!subscribers || subscribers.length === 0) {
    console.log("⚠️ No active subscribers found");
    return { sent: 0, failed: 0 };
  }

  console.log(`📧 Sending to ${subscribers.length} subscribers...`);

  // Send in batches of 100
  const batchSize = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    
    for (const subscriber of batch) {
      try {
        // Replace placeholder unsubscribe link with real token-based link
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`;
        let htmlBody = newsletter.html_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );
        const textBody = newsletter.text_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );

        // Add tracking pixel and rewrite links
        htmlBody = rewriteLinksForTracking(htmlBody, newsletter.id, subscriber.id, supabaseUrl);
        htmlBody = addTrackingPixel(htmlBody, newsletter.id, subscriber.id, supabaseUrl);

        const { error: sendError } = await resend.emails.send({
          from: "Lake Geneva Brief <newsletter@citybrief.info>",
          to: subscriber.email,
          subject: newsletter.subject,
          html: htmlBody,
          text: textBody,
        });

        if (sendError) {
          console.error(`Failed to send to ${subscriber.email}:`, sendError);
          failed++;
        } else {
          sent++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending to ${subscriber.email}:`, error);
        failed++;
      }
    }
  }

  return { sent, failed };
}
