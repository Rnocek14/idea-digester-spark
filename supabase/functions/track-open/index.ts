import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent PNG pixel
const TRACKING_PIXEL = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
), c => c.charCodeAt(0));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const newsletterId = url.searchParams.get("nid");
    const subscriberId = url.searchParams.get("sid");
    const email = url.searchParams.get("email");

    if (!newsletterId) {
      console.error("Missing newsletter_id parameter");
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/png", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/png", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the open event
    const { error } = await supabase.from("newsletter_opens").insert({
      newsletter_id: newsletterId,
      subscriber_id: subscriberId || null,
      subscriber_email: email || null,
      user_agent: req.headers.get("user-agent") || null,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    });

    if (error) {
      console.error("Failed to log open:", error);
    } else {
      console.log(`📧 Open tracked: newsletter=${newsletterId}, subscriber=${subscriberId || email}`);
    }

    // Always return the tracking pixel
    return new Response(TRACKING_PIXEL, {
      headers: { "Content-Type": "image/png", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Track open error:", error);
    return new Response(TRACKING_PIXEL, {
      headers: { "Content-Type": "image/png", ...corsHeaders },
    });
  }
});
