import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mirrors the options offered by QuickReportIncident.tsx — anything else is rejected.
const SYMPTOM_OPTIONS: Record<string, { label: string; type: string }> = {
  crash: { label: "Crash / major traffic backup", type: "accident" },
  smoke: { label: "Smoke or fire", type: "fire" },
  police: { label: "Heavy police activity", type: "police" },
  weather: { label: "Severe weather right now", type: "weather" },
  outage: { label: "Power outage", type: "utility" },
  other: { label: "Something else unusual", type: "other" },
};

const LOCATION_OPTIONS = [
  "Hwy 50",
  "Downtown / Main St",
  "Near the lake",
  "Residential neighborhood",
  "Not sure / Other",
];

const MAX_LOCATION_NOTE = 200;
const MAX_EXTRA_INFO = 500;
const PER_IP_PER_HOUR = 3;
const GLOBAL_PER_HOUR = 12;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`report-incident:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const symptoms: string[] = Array.isArray(body.symptoms) ? body.symptoms : [];
    const validSymptoms = symptoms.filter((s) => typeof s === "string" && s in SYMPTOM_OPTIONS);

    if (validSymptoms.length === 0) {
      return jsonResponse({ error: "Please select at least one option for what you're seeing." }, 400);
    }

    const locationChoice = LOCATION_OPTIONS.includes(body.location_choice)
      ? (body.location_choice as string)
      : "Not sure / Other";
    const locationNote = String(body.location_note ?? "").trim().slice(0, MAX_LOCATION_NOTE);
    const extraInfo = String(body.extra_info ?? "").trim().slice(0, MAX_EXTRA_INFO);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await hashIp(ip);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: globalCount } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "community_report")
      .gte("created_at", oneHourAgo);

    if ((globalCount ?? 0) >= GLOBAL_PER_HOUR) {
      return jsonResponse({ error: "Too many reports right now. Please try again later." }, 429);
    }

    const { count: ipCount } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "community_report")
      .eq("details->>ip_hash", ipHash)
      .gte("created_at", oneHourAgo);

    if ((ipCount ?? 0) >= PER_IP_PER_HOUR) {
      return jsonResponse({ error: "You've already sent a few reports recently. Please try again later." }, 429);
    }

    const primarySymptom = SYMPTOM_OPTIONS[validSymptoms[0]];
    const locationSummary =
      locationChoice === "Not sure / Other"
        ? (locationNote || locationChoice)
        : locationNote
        ? `${locationChoice} (${locationNote})`
        : locationChoice;

    const title = `Community report: ${primarySymptom.label.toLowerCase()}`;
    const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .insert({
        slug,
        title,
        incident_type: primarySymptom.type,
        status: "active",
        location: locationSummary || null,
        priority_score: 2,
      })
      .select("*")
      .single();

    if (incidentError || !incident) {
      console.error("[report-incident] Error creating incident", incidentError);
      return jsonResponse({ error: "Could not create incident." }, 500);
    }

    const summaryLines: string[] = [
      `Community quick report: ${validSymptoms
        .map((k) => SYMPTOM_OPTIONS[k].label)
        .join(", ")}`,
    ];
    if (locationSummary) summaryLines.push(`📍 Location: ${locationSummary}`);
    if (extraInfo) {
      summaryLines.push("");
      summaryLines.push(extraInfo);
    }

    const { error: updateError } = await supabase.from("incident_updates").insert({
      incident_id: incident.id,
      source: "community",
      source_label: "Community quick report",
      text: summaryLines.join("\n"),
      is_verified: false,
    });

    if (updateError) {
      console.error("[report-incident] Error creating update", updateError);
      return jsonResponse({ error: "Could not save incident update." }, 500);
    }

    await supabase.from("activity_log").insert({
      actor_type: "public",
      entity_type: "incident",
      entity_id: incident.id,
      action: "community_report",
      message: title,
      details: { ip_hash: ipHash, location: locationSummary },
    });

    return jsonResponse({ success: true, incident });
  } catch (error) {
    console.error("[report-incident] Error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
