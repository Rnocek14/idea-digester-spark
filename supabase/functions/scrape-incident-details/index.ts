import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncidentDetails {
  location: string | null;
  incident_time: string | null;
  responding_agencies: string[];
  injuries: string | null;
  fatalities: number | null;
  suspect_status: string | null;
  road_status: string | null;
  severity: "minor" | "moderate" | "serious" | "critical";
}

// Extract location from article text
function extractLocation(text: string): string | null {
  // Pattern: "in the X block of Y Street", "on Highway 50 near X", "at 123 Main St"
  const patterns = [
    /(?:in the\s+)?(\d{1,5}\s+block\s+of\s+[^,.\n\[\]]+)/i,
    /(?:on|at|near)\s+(highway\s+\d+[^,.\n\[\]]{0,40})/i,
    /(?:on|at|near)\s+((?:us|state)\s*[-]?\s*\d+[^,.\n\[\]]{0,40})/i,
    /(?:at|near)\s+(\d+\s+[A-Z][a-z]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard)[^,.\n\[\]]{0,20})/i,
    /(?:in|near|at)\s+(downtown\s+[a-z\s]{3,20})/i,
    /(?:in|near)\s+([a-z]+\s+(?:lake|park|beach|resort|marina)[^,.\n\[\]]{0,30})/i,
    /intersection\s+of\s+([^,.\n\[\]]+)/i,
    /corner\s+of\s+([^,.\n\[\]]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let location = match[1].trim();
      // Remove any markdown artifacts
      location = location.replace(/\[.*?\]\(.*?\)/g, '').replace(/[\[\]]/g, '').trim();
      // Clean up and validate
      if (location.length > 5 && location.length < 100 && !location.includes('http')) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }
  }

  return null;
}

// Extract time of incident
function extractIncidentTime(text: string): string | null {
  const patterns = [
    /(?:around|at|approximately|about)\s+(\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?))/i,
    /(\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?))\s+(?:on|this)/i,
    /(?:early|late)\s+(morning|afternoon|evening|night)/i,
    /(?:shortly\s+(?:before|after))\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

// Extract responding agencies
function extractRespondingAgencies(text: string): string[] {
  const agencies: string[] = [];
  const lowerText = text.toLowerCase();

  const agencyPatterns = [
    { pattern: /lake\s+geneva\s+(?:police|pd|fire|ems)/gi, name: "Lake Geneva" },
    { pattern: /walworth\s+county\s+(?:sheriff|deputies|ems)/gi, name: "Walworth County Sheriff" },
    { pattern: /fontana\s+(?:police|pd|fire)/gi, name: "Fontana" },
    { pattern: /williams\s+bay\s+(?:police|pd|fire)/gi, name: "Williams Bay" },
    { pattern: /elkhorn\s+(?:police|pd|fire)/gi, name: "Elkhorn" },
    { pattern: /delavan\s+(?:police|pd|fire)/gi, name: "Delavan" },
    { pattern: /state\s+patrol/gi, name: "State Patrol" },
    { pattern: /wisconsin\s+state\s+patrol/gi, name: "Wisconsin State Patrol" },
    { pattern: /flight\s+for\s+life/gi, name: "Flight for Life" },
    { pattern: /medflight/gi, name: "MedFlight" },
  ];

  for (const { pattern, name } of agencyPatterns) {
    if (pattern.test(text)) {
      if (!agencies.includes(name)) {
        agencies.push(name);
      }
    }
  }

  // Generic patterns
  if (lowerText.includes("police") && agencies.length === 0) {
    agencies.push("Police");
  }
  if (lowerText.includes("fire department") || lowerText.includes("firefighters")) {
    if (!agencies.some(a => a.includes("Fire"))) {
      agencies.push("Fire Department");
    }
  }
  if (lowerText.includes("ems") || lowerText.includes("paramedics") || lowerText.includes("ambulance")) {
    agencies.push("EMS");
  }

  return agencies;
}

// Extract injury information
function extractInjuries(text: string): string | null {
  const patterns = [
    /(\d+)\s+(?:people\s+|individuals?\s+)?(?:were\s+)?(?:injured|hospitalized|taken\s+to)/i,
    /(?:treated\s+for|suffered)\s+(?:minor\s+|serious\s+|critical\s+)?injuries/i,
    /no\s+(?:injuries|one\s+was\s+(?:injured|hurt))/i,
    /(?:minor|serious|critical|life[- ]threatening)\s+injuries/i,
    /(?:transported|rushed)\s+to\s+(?:the\s+)?hospital/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Check for "no injuries" first
      if (/no\s+(?:injuries|one\s+was)/i.test(text)) {
        return "No injuries reported";
      }
      if (match[1]) {
        return `${match[1]} injured`;
      }
      return match[0].trim();
    }
  }

  return null;
}

// Extract fatality count
function extractFatalities(text: string): number | null {
  const patterns = [
    /(\d+)\s+(?:people\s+|individuals?\s+)?(?:killed|dead|died|fatalities)/i,
    /(?:fatal|deadly)\s+(?:crash|accident|fire|shooting)/i,
    /pronounced\s+dead/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        return parseInt(match[1], 10);
      }
      // Fatal incident mentioned but no number - assume at least 1
      if (/fatal|deadly|pronounced\s+dead/i.test(match[0])) {
        return 1;
      }
    }
  }

  return null;
}

// Extract suspect status for police incidents
function extractSuspectStatus(text: string): string | null {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("in custody") || lowerText.includes("arrested") || lowerText.includes("apprehended")) {
    return "In custody";
  }
  if (lowerText.includes("at large") || lowerText.includes("still searching") || lowerText.includes("manhunt")) {
    return "At large";
  }
  if (lowerText.includes("turned themselves in") || lowerText.includes("surrendered")) {
    return "Surrendered";
  }
  if (lowerText.includes("no suspects") || lowerText.includes("unknown suspect")) {
    return "Unknown";
  }

  return null;
}

// Extract road status for traffic incidents
function extractRoadStatus(text: string): string | null {
  const patterns = [
    /(highway\s+\d+|us[- ]?\d+|state\s+\d+)\s+(?:is\s+)?(?:closed|blocked|shut\s+down)/i,
    /(?:road|street|intersection)\s+(?:is\s+)?(?:closed|blocked)/i,
    /(?:lanes?\s+(?:is|are)\s+)?closed/i,
    /detour\s+(?:in\s+place|set\s+up)/i,
    /traffic\s+(?:is\s+)?(?:being\s+)?(?:diverted|rerouted)/i,
    /(?:reopened|open\s+to\s+traffic)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

// Determine severity based on extracted details
function determineSeverity(details: Partial<IncidentDetails>, text: string): "minor" | "moderate" | "serious" | "critical" {
  const lowerText = text.toLowerCase();

  // Critical indicators
  if (details.fatalities && details.fatalities > 0) return "critical";
  if (lowerText.includes("mass casualty") || lowerText.includes("multiple fatalities")) return "critical";
  if (lowerText.includes("active shooter") || lowerText.includes("amber alert")) return "critical";

  // Serious indicators
  if (lowerText.includes("life-threatening") || lowerText.includes("critical condition")) return "serious";
  if (lowerText.includes("structure fire") || lowerText.includes("house fire")) return "serious";
  if (lowerText.includes("shooting") || lowerText.includes("stabbing")) return "serious";
  if (details.injuries && /\d+/.test(details.injuries) && parseInt(details.injuries) >= 3) return "serious";

  // Moderate indicators
  if (details.injuries && details.injuries !== "No injuries reported") return "moderate";
  if (details.road_status && /closed|blocked/i.test(details.road_status)) return "moderate";
  if (lowerText.includes("crash") || lowerText.includes("accident")) return "moderate";

  return "minor";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, title, incident_id } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[scrape-incident-details] Scraping: ${url}`);

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      console.error("[scrape-incident-details] FIRECRAWL_API_KEY not set");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Firecrawl to scrape the article
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error(`[scrape-incident-details] Firecrawl error: ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl error: ${firecrawlResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const markdown = firecrawlData.data?.markdown || "";
    const combinedText = `${title || ""} ${markdown}`;

    console.log(`[scrape-incident-details] Scraped ${markdown.length} chars`);

    // Extract all incident details
    const location = extractLocation(combinedText);
    const incident_time = extractIncidentTime(combinedText);
    const responding_agencies = extractRespondingAgencies(combinedText);
    const injuries = extractInjuries(combinedText);
    const fatalities = extractFatalities(combinedText);
    const suspect_status = extractSuspectStatus(combinedText);
    const road_status = extractRoadStatus(combinedText);

    const partialDetails = {
      location,
      incident_time,
      responding_agencies,
      injuries,
      fatalities,
      suspect_status,
      road_status,
    };

    const severity = determineSeverity(partialDetails, combinedText);

    const details: IncidentDetails = {
      ...partialDetails,
      severity,
    };

    console.log(`[scrape-incident-details] Extracted details:`, JSON.stringify(details));

    // If incident_id provided, update the incident directly
    if (incident_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Update incident location if we found one
      if (location) {
        const { error: updateError } = await supabase
          .from("incidents")
          .update({ location })
          .eq("id", incident_id);

        if (updateError) {
          console.error(`[scrape-incident-details] Failed to update incident location:`, updateError);
        } else {
          console.log(`[scrape-incident-details] Updated incident ${incident_id} with location: ${location}`);
        }
      }

      // Add enriched incident update with structured details
      const updateParts: string[] = [];
      if (location) updateParts.push(`📍 Location: ${location}`);
      if (incident_time) updateParts.push(`⏰ Time: ${incident_time}`);
      if (responding_agencies.length > 0) updateParts.push(`🚨 Responding: ${responding_agencies.join(", ")}`);
      if (injuries) updateParts.push(`🏥 Injuries: ${injuries}`);
      if (fatalities !== null) updateParts.push(`⚠️ Fatalities: ${fatalities}`);
      if (road_status) updateParts.push(`🚗 Road: ${road_status}`);
      if (suspect_status) updateParts.push(`👮 Suspect: ${suspect_status}`);

      if (updateParts.length > 0) {
        const { error: insertError } = await supabase
          .from("incident_updates")
          .insert({
            incident_id,
            source: "firecrawl",
            source_label: "Auto-enriched details",
            text: updateParts.join("\n"),
            is_verified: true,
          });

        if (insertError) {
          console.error(`[scrape-incident-details] Failed to insert incident update:`, insertError);
        } else {
          console.log(`[scrape-incident-details] Added enriched update to incident ${incident_id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[scrape-incident-details] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
