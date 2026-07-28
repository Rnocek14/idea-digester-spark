import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { story_ids, decision_path } = await req.json();

  if (!story_ids?.length) {
    return new Response(JSON.stringify({ error: "No story_ids provided" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data, error } = await supabase
    .from("content_queue")
    .update({
      status: "auto_published",
      decision_path: decision_path || "manual_unblock",
      hold_reason: null,
    })
    .in("id", story_ids)
    .eq("status", "pending")
    .select("id, title");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ approved: data?.length || 0, stories: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
