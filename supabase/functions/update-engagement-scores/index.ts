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
    console.log("📊 Updating subscriber engagement scores...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all subscribers
    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("id, email");

    if (subError) throw subError;
    if (!subscribers || subscribers.length === 0) {
      console.log("No subscribers to update");
      return new Response(
        JSON.stringify({ success: true, updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 Processing ${subscribers.length} subscribers...`);

    let updated = 0;

    // Process each subscriber
    for (const subscriber of subscribers) {
      // Count opens
      const { data: opens } = await supabase
        .from("newsletter_opens")
        .select("id", { count: "exact" })
        .or(`subscriber_id.eq.${subscriber.id},subscriber_email.eq.${subscriber.email}`);

      const openCount = opens?.length || 0;

      // Count clicks
      const { data: clicks } = await supabase
        .from("newsletter_clicks")
        .select("id", { count: "exact" })
        .or(`subscriber_id.eq.${subscriber.id},subscriber_email.eq.${subscriber.email}`);

      const clickCount = clicks?.length || 0;

      // Get last open and click timestamps
      const { data: lastOpen } = await supabase
        .from("newsletter_opens")
        .select("opened_at")
        .or(`subscriber_id.eq.${subscriber.id},subscriber_email.eq.${subscriber.email}`)
        .order("opened_at", { ascending: false })
        .limit(1)
        .single();

      const { data: lastClick } = await supabase
        .from("newsletter_clicks")
        .select("clicked_at")
        .or(`subscriber_id.eq.${subscriber.id},subscriber_email.eq.${subscriber.email}`)
        .order("clicked_at", { ascending: false })
        .limit(1)
        .single();

      // Calculate engagement score
      // Formula: (opens * 1) + (clicks * 3) = score
      // Clicks are weighted 3x more than opens
      const engagementScore = (openCount * 1) + (clickCount * 3);

      // Update subscriber
      const { error: updateError } = await supabase
        .from("subscribers")
        .update({
          engagement_score: engagementScore,
          last_opened_at: lastOpen?.opened_at || null,
          last_clicked_at: lastClick?.clicked_at || null,
        })
        .eq("id", subscriber.id);

      if (updateError) {
        console.error(`Failed to update ${subscriber.email}:`, updateError);
      } else {
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} subscriber engagement scores`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        total: subscribers.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Update engagement scores error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
