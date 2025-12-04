import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const newsletterId = url.searchParams.get("nid");
    const subscriberId = url.searchParams.get("sid");
    const email = url.searchParams.get("email");
    const targetUrl = url.searchParams.get("url");
    const businessId = url.searchParams.get("bid");
    const placementId = url.searchParams.get("pid");
    const clickSource = url.searchParams.get("source");
    const trackOnly = url.searchParams.get("track_only") === "true";

    // Must have target URL
    if (!targetUrl) {
      return new Response("Missing target URL", { status: 400, headers: corsHeaders });
    }

    // Decode the target URL
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
    } catch {
      decodedUrl = targetUrl;
    }

    // Log click (newsletter or web)
    const shouldLog = newsletterId || (businessId && clickSource);
    if (shouldLog) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error } = await supabase.from("newsletter_clicks").insert({
          newsletter_id: newsletterId || null,
          subscriber_id: subscriberId || null,
          subscriber_email: email || null,
          link_url: decodedUrl,
          business_id: businessId || null,
          ad_placement_id: placementId || null,
          click_source: clickSource || (newsletterId ? 'newsletter_sponsor' : null),
          user_agent: req.headers.get("user-agent") || null,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        });

        if (error) {
          console.error("Failed to log click:", error);
        } else {
          console.log(`🔗 Click tracked: source=${clickSource || 'newsletter'}, business=${businessId}, url=${decodedUrl}`);
        }
      }
    }

    // If track_only mode, just return success JSON (for mailto: links and other non-redirect scenarios)
    if (trackOnly) {
      return new Response(JSON.stringify({ success: true, tracked: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For mailto: URLs, return JSON instead of redirect (browsers can't redirect to mailto:)
    if (decodedUrl.startsWith("mailto:")) {
      return new Response(JSON.stringify({ success: true, tracked: true, url: decodedUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Redirect to the original URL for normal http/https links
    return new Response(null, {
      status: 302,
      headers: {
        Location: decodedUrl,
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Track click error:", error);
    
    // On error, try to redirect to URL if we have it, otherwise error
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    if (targetUrl) {
      try {
        const decoded = decodeURIComponent(targetUrl);
        // Don't try to redirect mailto: URLs
        if (!decoded.startsWith("mailto:")) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: decoded,
              ...corsHeaders,
            },
          });
        }
      } catch {}
    }
    
    return new Response("Error processing click", { status: 500, headers: corsHeaders });
  }
});
