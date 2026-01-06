import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RenewJobRequest {
  job_id: string;
  token: string;
  days?: number; // Default 30 days
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id, token, days = 30 }: RenewJobRequest = await req.json();

    if (!job_id || !token) {
      return new Response(
        JSON.stringify({ error: "job_id and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the token
    const { data: tokenData, error: tokenError } = await supabase
      .from("employer_access_tokens")
      .select("email, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token validation failed:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired access token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Access token has expired. Please request a new link." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from("job_listings")
      .select("id, contact_email, expires_at, status, title")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error("Job fetch failed:", jobError);
      return new Response(
        JSON.stringify({ error: "Job listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the token email matches the job contact email
    if (job.contact_email.toLowerCase() !== tokenData.email.toLowerCase()) {
      console.error("Email mismatch:", { jobEmail: job.contact_email, tokenEmail: tokenData.email });
      return new Response(
        JSON.stringify({ error: "You don't have permission to renew this job listing" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new expiry date
    // If job is already expired, extend from now. Otherwise extend from current expiry.
    const currentExpiry = new Date(job.expires_at);
    const now = new Date();
    const baseDate = currentExpiry < now ? now : currentExpiry;
    const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Update the job listing
    const { error: updateError } = await supabase
      .from("job_listings")
      .update({
        expires_at: newExpiry.toISOString(),
        status: job.status === "approved" ? "approved" : "pending", // Keep approved or set back to pending
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    if (updateError) {
      console.error("Update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to renew job listing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Job ${job_id} renewed for ${days} days. New expiry: ${newExpiry.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Job listing "${job.title}" renewed for ${days} days`,
        new_expires_at: newExpiry.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in renew-job-listing:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
