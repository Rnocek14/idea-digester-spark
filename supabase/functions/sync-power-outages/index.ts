import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Walworth County area zip codes and municipalities
const WALWORTH_AREA = [
  'walworth', 'lake geneva', 'elkhorn', 'delavan', 'williams bay',
  'fontana', 'east troy', 'whitewater', 'sharon', 'darien', 'genoa city',
  '53147', '53121', '53115', '53190', '53191', '53125', // common zip codes
];

function isWalworthArea(text: string): boolean {
  const lower = text.toLowerCase();
  return WALWORTH_AREA.some(kw => lower.includes(kw));
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      console.error("[sync-power-outages] FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      processed: 0,
      inserted: 0,
      resolved: 0,
      skipped: 0,
      errors: [] as string[],
    };

    console.log("[sync-power-outages] Checking WE Energies outage map...");

    // WE Energies outage map - try to scrape their public outage page
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.we-energies.com/outagemapext/",
        formats: ["markdown"],
        waitFor: 5000,
        onlyMainContent: true,
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text();
      console.error("[sync-power-outages] Firecrawl error:", errText);
      
      // Try alternative: Down Detector for WE Energies
      console.log("[sync-power-outages] Trying Down Detector as fallback...");
      
      const ddRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://downdetector.com/status/we-energies/",
          formats: ["markdown"],
          waitFor: 3000,
          onlyMainContent: true,
        }),
      });

      if (!ddRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not reach outage sources" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ddData = await ddRes.json();
      const markdown = ddData.data?.markdown || "";
      
      // Check for major outage indicators
      const lower = markdown.toLowerCase();
      const hasOutage = lower.includes('problems') || lower.includes('outage') || 
                       lower.includes('down') || lower.includes('issues');
      
      if (hasOutage && (lower.includes('spike') || lower.includes('increase'))) {
        console.log("[sync-power-outages] Down Detector shows potential outage activity");
        // This is just an indicator - we'd need the actual WE Energies data for specifics
      }

      return new Response(
        JSON.stringify({ success: true, message: "Checked Down Detector", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcData = await fcRes.json();
    const markdown: string = fcData.data?.markdown || "";

    if (!markdown || markdown.length < 50) {
      console.log("[sync-power-outages] No significant content from WE Energies");
      return new Response(
        JSON.stringify({ success: true, message: "No outages detected", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-power-outages] Received ${markdown.length} chars`);

    // Parse outage information
    // WE Energies typically shows: "X customers affected" or "Outage in [Area]"
    const lines = markdown.split('\n').filter(l => l.trim().length > 10);
    
    for (const line of lines) {
      results.processed++;
      
      const lower = line.toLowerCase();
      
      // Look for outage indicators
      const hasOutageKeyword = 
        lower.includes('outage') || lower.includes('customers affected') ||
        lower.includes('without power') || lower.includes('power out');
      
      if (!hasOutageKeyword) {
        continue;
      }

      // Check if it's in Walworth area
      if (!isWalworthArea(line)) {
        results.skipped++;
        continue;
      }

      // Extract customer count if available
      const customerMatch = line.match(/(\d{1,6})\s*customers?/i);
      const customerCount = customerMatch ? parseInt(customerMatch[1]) : null;
      
      // Build title
      let title = 'Power Outage in Walworth County';
      if (customerCount) {
        title = `Power Outage: ${customerCount.toLocaleString()} customers affected`;
      }

      const slug = slugifyTitle(title) + '-' + Date.now().toString(36);
      const priorityScore = customerCount && customerCount > 1000 ? 7 : 
                           customerCount && customerCount > 100 ? 5 : 4;

      // Check for existing active power outage
      const { data: existing } = await supabase
        .from("incidents")
        .select("id")
        .eq("incident_type", "utility")
        .eq("status", "active")
        .ilike("title", "%power outage%")
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[sync-power-outages] Active outage already exists`);
        
        // Update the existing incident with new info
        await supabase.from("incident_updates").insert({
          incident_id: existing[0].id,
          source: 'we_energies',
          source_label: 'WE Energies',
          text: line.trim().substring(0, 500),
          is_verified: true,
        });
        
        results.skipped++;
        continue;
      }

      // Create new outage incident
      const { data: newIncident, error: insertError } = await supabase
        .from("incidents")
        .insert({
          slug,
          title,
          incident_type: 'utility',
          status: 'active',
          priority_score: priorityScore,
          started_at: new Date().toISOString(),
          location: 'Walworth County',
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[sync-power-outages] Insert error:`, insertError);
        results.errors.push(insertError.message);
      } else {
        // Add initial update
        await supabase.from("incident_updates").insert({
          incident_id: newIncident.id,
          source: 'we_energies',
          source_label: 'WE Energies',
          text: line.trim().substring(0, 500),
          is_verified: true,
        });

        console.log(`[sync-power-outages] ✅ Created outage incident`);
        results.inserted++;
      }
    }

    // Check for resolved outages - if no active outages found, resolve any existing
    if (results.inserted === 0 && results.processed > 0) {
      const { data: activeOutages } = await supabase
        .from("incidents")
        .select("id")
        .eq("incident_type", "utility")
        .eq("status", "active")
        .lt("started_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      if (activeOutages && activeOutages.length > 0) {
        for (const outage of activeOutages) {
          await supabase
            .from("incidents")
            .update({ 
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_reason: 'Power restored'
            })
            .eq("id", outage.id);
          
          results.resolved++;
        }
        console.log(`[sync-power-outages] Resolved ${results.resolved} old outages`);
      }
    }

    console.log(`[sync-power-outages] Complete:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[sync-power-outages] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
