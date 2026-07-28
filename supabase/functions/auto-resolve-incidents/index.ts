import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Type-specific timeout rules (in hours)
const TIMEOUT_RULES: Record<string, { maxAge: number; maxSilence: number }> = {
  // Traffic/Accidents: 6h max age, 3h since last update
  accident: { maxAge: 6, maxSilence: 3 },
  traffic: { maxAge: 6, maxSilence: 3 },
  road_closure: { maxAge: 6, maxSilence: 3 },
  
  // Weather: 6h max age, 4h silence (NWS alerts typically short-lived)
  weather: { maxAge: 6, maxSilence: 4 },
  
  // Fire/Safety: 24h max age, 6h since last update
  fire: { maxAge: 24, maxSilence: 6 },
  public_safety: { maxAge: 24, maxSilence: 6 },
  police: { maxAge: 24, maxSilence: 6 },
  
  // Generic/Other: 12h max
  other: { maxAge: 12, maxSilence: 12 },
  community: { maxAge: 12, maxSilence: 12 },
};

// Parse NWS alert expiration from title (e.g., "...until January 14 at 10:00AM CST...")
const parseNWSExpiration = (title: string): Date | null => {
  const match = title.match(/until\s+(\w+\s+\d+)\s+at\s+(\d+:\d+(?:AM|PM))\s+CST/i);
  if (!match) return null;
  
  const [, dateStr, timeStr] = match;
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${dateStr} ${currentYear} ${timeStr}`);
  
  // Handle year rollover (e.g., December alert in January)
  if (parsed.getMonth() > new Date().getMonth() + 6) {
    parsed.setFullYear(currentYear - 1);
  }
  
  return isNaN(parsed.getTime()) ? null : parsed;
};

const getResolutionReason = (incidentType: string): string => {
  if (["accident", "traffic", "road_closure"].includes(incidentType)) {
    return "auto_timeout_traffic";
  }
  if (incidentType === "weather") {
    return "auto_timeout_weather";
  }
  if (["fire", "public_safety", "police"].includes(incidentType)) {
    return "auto_timeout_safety";
  }
  return "auto_timeout_generic";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting auto-resolve incidents job...");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();

    // Zero-touch queue hygiene: anything sitting in pending_review for 7+ days
    // was never going to be reviewed (one operator, many cities) — auto-reject
    // it so hold queues can never rot.
    const reviewCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleHolds } = await supabase
      .from("incidents")
      .update({
        status: "rejected",
        resolution_reason: "auto_rejected_stale_review_queue",
        updated_at: now.toISOString(),
      })
      .eq("status", "pending_review")
      .lt("created_at", reviewCutoff)
      .select("id");
    if (staleHolds?.length) {
      console.log(`Auto-rejected ${staleHolds.length} stale pending_review incidents`);
    }

    // Fetch live incidents ('developing' ages out on the same rules as 'active')
    const { data: incidents, error: fetchError } = await supabase
      .from("incidents")
      .select("id, incident_type, status, started_at, updated_at, title")
      .in("status", ["active", "developing", "monitoring"]);

    if (fetchError) {
      console.error("Error fetching incidents:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${incidents?.length || 0} active/monitoring incidents`);

    if (!incidents || incidents.length === 0) {
      return new Response(
        JSON.stringify({ resolved: 0, message: "No active incidents to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each incident, get the latest update timestamp
    const incidentIds = incidents.map(i => i.id);
    const { data: updates } = await supabase
      .from("incident_updates")
      .select("incident_id, created_at")
      .in("incident_id", incidentIds)
      .order("created_at", { ascending: false });

    // Build a map of incident_id -> latest update time
    const latestUpdateMap = new Map<string, string>();
    for (const update of updates || []) {
      if (!latestUpdateMap.has(update.incident_id)) {
        latestUpdateMap.set(update.incident_id, update.created_at);
      }
    }

    const toResolve: { id: string; reason: string }[] = [];

    for (const incident of incidents) {
      const rules = TIMEOUT_RULES[incident.incident_type] || TIMEOUT_RULES.other;
      
      const startedAt = new Date(incident.started_at);
      const lastUpdateAt = latestUpdateMap.get(incident.id) 
        ? new Date(latestUpdateMap.get(incident.id)!)
        : new Date(incident.updated_at || incident.started_at);

      const ageHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      const silenceHours = (now.getTime() - lastUpdateAt.getTime()) / (1000 * 60 * 60);

      console.log(`Incident ${incident.id} (${incident.incident_type}): age=${ageHours.toFixed(1)}h, silence=${silenceHours.toFixed(1)}h, rules: maxAge=${rules.maxAge}h, maxSilence=${rules.maxSilence}h`);

      // Special handling for weather alerts: check if NWS expiration time has passed
      if (incident.incident_type === "weather" && (incident as any).title) {
        const nwsExpiration = parseNWSExpiration((incident as any).title);
        if (nwsExpiration && now > nwsExpiration) {
          toResolve.push({
            id: incident.id,
            reason: "nws_alert_expired",
          });
          console.log(`→ Marking for auto-resolve (NWS expired at ${nwsExpiration.toISOString()}): ${incident.id}`);
          continue;
        }
      }

      // Check if incident should be resolved based on age/silence rules
      if (ageHours > rules.maxAge && silenceHours > rules.maxSilence) {
        toResolve.push({
          id: incident.id,
          reason: getResolutionReason(incident.incident_type),
        });
        console.log(`→ Marking for auto-resolve: ${incident.id}`);
      }
    }

    console.log(`Resolving ${toResolve.length} incidents...`);

    // Resolve each incident
    let resolvedCount = 0;
    for (const item of toResolve) {
      const { error: updateError } = await supabase
        .from("incidents")
        .update({
          status: "resolved",
          resolved_at: now.toISOString(),
          resolution_reason: item.reason,
          updated_at: now.toISOString(),
        })
        .eq("id", item.id);

      if (updateError) {
        console.error(`Failed to resolve incident ${item.id}:`, updateError);
      } else {
        resolvedCount++;
        console.log(`Resolved incident ${item.id} with reason: ${item.reason}`);
      }
    }

    console.log(`Auto-resolve complete. Resolved ${resolvedCount}/${toResolve.length} incidents.`);

    return new Response(
      JSON.stringify({
        resolved: resolvedCount,
        checked: incidents.length,
        message: `Auto-resolved ${resolvedCount} incidents`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-resolve incidents error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
