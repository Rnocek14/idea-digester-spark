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
  '53147', '53121', '53115', '53190', '53191', '53125',
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

// Parse outage data from text content
function parseOutageInfo(content: string): { 
  customerCount: number | null; 
  areas: string[];
  hasActiveOutage: boolean;
} {
  const lower = content.toLowerCase();
  
  // Check for outage indicators
  const hasActiveOutage = 
    lower.includes('outage') || 
    lower.includes('customers affected') ||
    lower.includes('without power') || 
    lower.includes('power out') ||
    lower.includes('customers out');
  
  // Extract customer count
  let customerCount: number | null = null;
  const customerMatch = content.match(/(\d{1,6})\s*customers?/i);
  if (customerMatch) {
    customerCount = parseInt(customerMatch[1]);
  }
  
  // Also try patterns like "1,234 customers"
  const commaMatch = content.match(/(\d{1,3}(?:,\d{3})*)\s*customers?/i);
  if (commaMatch && !customerCount) {
    customerCount = parseInt(commaMatch[1].replace(/,/g, ''));
  }
  
  // Extract affected areas
  const areas: string[] = [];
  for (const area of WALWORTH_AREA) {
    if (lower.includes(area)) {
      areas.push(area);
    }
  }
  
  return { customerCount, areas, hasActiveOutage };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      method: "scrape-content",
      processed: 0,
      inserted: 0,
      resolved: 0,
      skipped: 0,
      errors: [] as string[],
      static_fetch_used: true,
      firecrawl_used: false,
    };

    console.log("[sync-power-outages] Checking WE Energies outage map...");

    // Primary source: WE Energies outage map
    const weEnergiesUrl = "https://www.we-energies.com/outagemapext/";
    
    // Step 1: Try static fetch first
    let content = "";
    
    try {
      console.log("[sync-power-outages] Attempting static fetch...");
      const staticRes = await fetch(weEnergiesUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      
      if (staticRes.ok) {
        content = await staticRes.text();
        console.log(`[sync-power-outages] Static fetch: ${content.length} chars`);
      }
    } catch (err) {
      console.log("[sync-power-outages] Static fetch failed:", err);
    }

    // Step 2: If static fetch insufficient, use scrape-content
    if (content.length < 500 || !content.toLowerCase().includes('outage')) {
      console.log("[sync-power-outages] Using scrape-content with AI extraction...");
      
      const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: weEnergiesUrl,
          extract_type: "incident", // Use incident schema for outages
          use_firecrawl: true, // Outage maps are often JS-heavy
        }),
      });
      
      if (!scrapeResponse.ok) {
        // Try Down Detector as fallback
        console.log("[sync-power-outages] Primary failed, trying Down Detector...");
        
        const ddResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: "https://downdetector.com/status/we-energies/",
            extract_type: "incident",
            use_firecrawl: true,
          }),
        });
        
        if (ddResponse.ok) {
          const ddData = await ddResponse.json();
          content = ddData.raw_content || ddData.data?.description || "";
          results.firecrawl_used = ddData.used_firecrawl || false;
        }
      } else {
        const scrapeData = await scrapeResponse.json();
        results.firecrawl_used = scrapeData.used_firecrawl || false;
        results.static_fetch_used = !results.firecrawl_used;
        
        // Get structured data if available
        if (scrapeData.success && scrapeData.data) {
          const extracted = scrapeData.data;
          
          // If we got structured incident data, use it directly
          if (extracted.location || extracted.description) {
            content = `${extracted.description || ''} ${extracted.location || ''} ${extracted.injuries || ''}`;
          }
        }
        
        // Also get raw content
        content = content || scrapeData.raw_content || "";
      }
    }

    if (content.length < 50) {
      console.log("[sync-power-outages] No significant content available");
      return new Response(
        JSON.stringify({ success: true, message: "No outage data available", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-power-outages] Analyzing ${content.length} chars of content`);
    results.processed++;

    // Step 3: Parse outage information
    const outageInfo = parseOutageInfo(content);
    
    if (!outageInfo.hasActiveOutage) {
      console.log("[sync-power-outages] No active outages detected");
      
      // Check for old active outages to resolve
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
      
      return new Response(
        JSON.stringify({ success: true, message: "No active outages", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if outage is in Walworth area
    if (outageInfo.areas.length === 0 && !isWalworthArea(content)) {
      console.log("[sync-power-outages] Outage not in Walworth County area");
      results.skipped++;
      return new Response(
        JSON.stringify({ success: true, message: "Outage outside coverage area", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build title
    let title = 'Power Outage in Walworth County';
    if (outageInfo.customerCount) {
      title = `Power Outage: ${outageInfo.customerCount.toLocaleString()} customers affected`;
    }
    if (outageInfo.areas.length > 0) {
      title = `Power Outage in ${outageInfo.areas[0].charAt(0).toUpperCase() + outageInfo.areas[0].slice(1)}`;
      if (outageInfo.customerCount) {
        title += ` - ${outageInfo.customerCount.toLocaleString()} affected`;
      }
    }

    const priorityScore = outageInfo.customerCount && outageInfo.customerCount > 1000 ? 7 : 
                         outageInfo.customerCount && outageInfo.customerCount > 100 ? 5 : 4;

    // Check for existing active power outage
    const { data: existing } = await supabase
      .from("incidents")
      .select("id")
      .eq("incident_type", "utility")
      .eq("status", "active")
      .ilike("title", "%power outage%")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[sync-power-outages] Active outage already exists, updating...`);
      
      // Update the existing incident with new info
      await supabase.from("incident_updates").insert({
        incident_id: existing[0].id,
        source: 'we_energies',
        source_label: 'WE Energies',
        text: `Update: ${outageInfo.customerCount ? outageInfo.customerCount.toLocaleString() + ' customers affected' : 'Ongoing outage'}`,
        is_verified: true,
      });
      
      results.skipped++;
    } else {
      // Create new outage incident
      const slug = slugifyTitle(title) + '-' + Date.now().toString(36);
      
      const { data: newIncident, error: insertError } = await supabase
        .from("incidents")
        .insert({
          slug,
          title,
          incident_type: 'utility',
          status: 'active',
          priority_score: priorityScore,
          started_at: new Date().toISOString(),
          location: outageInfo.areas.length > 0 
            ? outageInfo.areas.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
            : 'Walworth County',
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
          text: outageInfo.customerCount 
            ? `${outageInfo.customerCount.toLocaleString()} customers affected`
            : 'Power outage reported',
          is_verified: true,
        });

        console.log(`[sync-power-outages] ✅ Created outage incident: ${title}`);
        results.inserted++;
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
