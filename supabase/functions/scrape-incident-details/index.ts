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

// Determine severity based on extracted details
function determineSeverity(details: Partial<IncidentDetails>, incidentType?: string): "minor" | "moderate" | "serious" | "critical" {
  // Critical indicators
  if (details.fatalities && details.fatalities > 0) return "critical";

  // Serious indicators
  if (details.injuries && /critical|life-threatening|\d+ injured/.test(details.injuries)) return "serious";
  if (incidentType && ['fire', 'shooting', 'stabbing'].includes(incidentType)) return "serious";

  // Moderate indicators
  if (details.injuries && details.injuries !== "No injuries reported") return "moderate";
  if (details.road_status && /closed|blocked/i.test(details.road_status)) return "moderate";

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

    console.log(`[scrape-incident-details] Scraping via scrape-content: ${url}`);

    // Call the centralized scrape-content function with extract_type: 'incident'
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey, // Include apikey for Edge Function auth compatibility
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        extract_type: "incident",
        use_firecrawl: true, // Allow fallback for JS-rendered pages
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error(`[scrape-incident-details] scrape-content error: ${scrapeResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `scrape-content error: ${scrapeResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeData.success) {
      console.error(`[scrape-incident-details] scrape-content failed:`, scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || "Extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ scrape-content success (firecrawl: ${scrapeData.used_firecrawl})`);

    const extracted = scrapeData.data || {};

    // Map scrape-content incident schema to our expected output
    const partialDetails: Partial<IncidentDetails> = {
      location: extracted.location || null,
      incident_time: extracted.incident_time || null,
      responding_agencies: extracted.responding_agencies || [],
      injuries: extracted.injuries || null,
      fatalities: extracted.fatalities || null,
      suspect_status: extracted.suspect_status || null,
      road_status: extracted.road_status || null,
    };

    const severity = determineSeverity(partialDetails, extracted.incident_type);

    const details: IncidentDetails = {
      ...partialDetails as IncidentDetails,
      severity,
    };

    console.log(`[scrape-incident-details] Extracted details:`, JSON.stringify(details));

    // If incident_id provided, update the incident directly
    if (incident_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Update incident location if we found one
      if (details.location) {
        const { error: updateError } = await supabase
          .from("incidents")
          .update({ location: details.location })
          .eq("id", incident_id);

        if (updateError) {
          console.error(`[scrape-incident-details] Failed to update incident location:`, updateError);
        } else {
          console.log(`[scrape-incident-details] Updated incident ${incident_id} with location: ${details.location}`);
        }
      }

      // Add enriched incident update with structured details
      const updateParts: string[] = [];
      if (details.location) updateParts.push(`📍 Location: ${details.location}`);
      if (details.incident_time) updateParts.push(`⏰ Time: ${details.incident_time}`);
      if (details.responding_agencies.length > 0) updateParts.push(`🚨 Responding: ${details.responding_agencies.join(", ")}`);
      if (details.injuries) updateParts.push(`🏥 Injuries: ${details.injuries}`);
      if (details.fatalities !== null) updateParts.push(`⚠️ Fatalities: ${details.fatalities}`);
      if (details.road_status) updateParts.push(`🚗 Road: ${details.road_status}`);
      if (details.suspect_status) updateParts.push(`👮 Suspect: ${details.suspect_status}`);

      if (updateParts.length > 0) {
        const { error: insertError } = await supabase
          .from("incident_updates")
          .insert({
            incident_id,
            source: "ai-extraction",
            source_label: "AI-enriched details",
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
      JSON.stringify({ 
        success: true, 
        details,
        used_firecrawl: scrapeData.used_firecrawl,
        ai_extracted: true,
      }),
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
