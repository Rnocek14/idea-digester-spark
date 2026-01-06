import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackJobClickRequest {
  job_id: string;
  source?: string;
  newsletter_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id, source = "website", newsletter_id }: TrackJobClickRequest = await req.json();
    
    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request metadata
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                       req.headers.get("x-real-ip") || 
                       null;
    const user_agent = req.headers.get("user-agent") || null;

    // Insert click record
    const { error } = await supabase
      .from("job_clicks")
      .insert({
        job_id,
        source,
        newsletter_id: newsletter_id || null,
        ip_address,
        user_agent,
      });

    if (error) {
      console.error("Error tracking job click:", error);
      // Don't fail the request - tracking is non-critical
    } else {
      console.log(`Tracked click for job ${job_id} from ${source}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in track-job-click:", error);
    // Return success anyway - don't block user action for tracking failure
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
