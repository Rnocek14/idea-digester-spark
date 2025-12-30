import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IncidentType = 'accident' | 'crime' | 'police' | 'fire' | 'other';

// Incident type inference from title/content
function inferIncidentType(text: string): { type: IncidentType; priority: number } {
  const lower = text.toLowerCase();
  
  if (lower.includes('fatal') || lower.includes('death') || lower.includes('homicide')) {
    return { type: 'crime', priority: 9 };
  }
  if (lower.includes('shooting') || lower.includes('shots fired')) {
    return { type: 'police', priority: 8 };
  }
  if (lower.includes('crash') || lower.includes('accident') || lower.includes('collision')) {
    return { type: 'accident', priority: lower.includes('fatal') || lower.includes('serious') ? 8 : 6 };
  }
  if (lower.includes('fire') || lower.includes('arson')) {
    return { type: 'fire', priority: 7 };
  }
  if (lower.includes('arrest') || lower.includes('robbery') || lower.includes('burglary')) {
    return { type: 'crime', priority: 5 };
  }
  if (lower.includes('missing') || lower.includes('search')) {
    return { type: 'police', priority: 7 };
  }
  
  return { type: 'police', priority: 4 };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Simple hash for deduplication
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
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
      console.error("[sync-sheriff] FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      releases_found: [] as string[],
    };

    console.log("[sync-sheriff] Fetching Walworth County Sheriff news releases...");

    // Scrape the news releases page with JavaScript wait
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.co.walworth.wi.us/747/News-Releases",
        formats: ["markdown", "html", "links"],
        waitFor: 8000,  // Wait for JS to load
        onlyMainContent: false,
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text();
      console.error("[sync-sheriff] Firecrawl error:", fcRes.status, errText);
      
      // Check for credit exhaustion (402 or credit-related error)
      const isCreditsExhausted = fcRes.status === 402 || 
        errText.toLowerCase().includes('credit') || 
        errText.toLowerCase().includes('limit') ||
        errText.toLowerCase().includes('quota');
      
      if (isCreditsExhausted) {
        console.warn("[sync-sheriff] Firecrawl credits exhausted - disabling source");
        
        // Get current metadata and merge with disabled flags
        const { data: sourceData } = await supabase
          .from("sources")
          .select("metadata")
          .eq("name", "Walworth County Sheriff News")
          .single();
        
        const currentMetadata = (sourceData?.metadata as Record<string, unknown>) || {};
        
        await supabase
          .from("sources")
          .update({
            status: 'inactive',
            metadata: {
              ...currentMetadata,
              disabled_reason: 'firecrawl_credits_exhausted',
              disabled_at: new Date().toISOString(),
              requires_firecrawl_credits: true,
            },
          })
          .eq("name", "Walworth County Sheriff News");
        
        return new Response(
          JSON.stringify({ success: false, error: "Firecrawl credits exhausted", credits_exhausted: true }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcData = await fcRes.json();
    const markdown: string = fcData.data?.markdown || "";
    const html: string = fcData.data?.html || "";
    const links: string[] = fcData.data?.links || [];

    console.log(`[sync-sheriff] Received: markdown=${markdown.length}, html=${html.length}, links=${links.length}`);

    // Find news release PDF links
    const pdfPattern = /DocumentCenter\/View\/(\d+)\/([^"'\s]+News-Release[^"'\s]*)/gi;
    const foundReleases: Array<{ id: string; filename: string; url: string }> = [];

    // Search in HTML
    let match;
    while ((match = pdfPattern.exec(html)) !== null) {
      foundReleases.push({
        id: match[1],
        filename: match[2],
        url: `https://www.co.walworth.wi.us/DocumentCenter/View/${match[1]}/${match[2]}`,
      });
    }

    // Also check links array
    for (const link of links) {
      if (link.includes('News-Release') && link.includes('DocumentCenter')) {
        const linkMatch = link.match(/DocumentCenter\/View\/(\d+)\/([^"'\s]+)/);
        if (linkMatch) {
          foundReleases.push({
            id: linkMatch[1],
            filename: linkMatch[2],
            url: link,
          });
        }
      }
    }

    // Dedupe releases by ID
    const uniqueReleases = Array.from(new Map(foundReleases.map(r => [r.id, r])).values());
    
    console.log(`[sync-sheriff] Found ${uniqueReleases.length} unique news releases`);
    results.releases_found = uniqueReleases.map(r => r.filename);

    // Process each release (limit to most recent 5)
    for (const release of uniqueReleases.slice(0, 5)) {
      results.processed++;

      // Extract incident number from filename (e.g., "25-036149-News-Release-PDF")
      const incidentMatch = release.filename.match(/(\d{2}-\d{5,6})/);
      const incidentNumber = incidentMatch ? incidentMatch[1] : null;

      if (!incidentNumber) {
        console.log(`[sync-sheriff] No incident number in: ${release.filename}`);
        results.skipped++;
        continue;
      }

      // Check if we already have this incident
      const externalId = await hashString(`sheriff-${incidentNumber}`);
      
      const { data: existing } = await supabase
        .from("incidents")
        .select("id")
        .eq("source", "sheriff")
        .eq("external_id", externalId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[sync-sheriff] Skipping existing: ${incidentNumber}`);
        results.skipped++;
        continue;
      }

      // Scrape the PDF page to get details
      console.log(`[sync-sheriff] Fetching release: ${release.url}`);
      
      const pdfRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: release.url,
          formats: ["markdown"],
          waitFor: 3000,
        }),
      });

      if (!pdfRes.ok) {
        console.warn(`[sync-sheriff] Failed to fetch release: ${release.url}`);
        results.errors.push(`Failed to fetch ${release.filename}`);
        continue;
      }

      const pdfData = await pdfRes.json();
      const pdfContent = pdfData.data?.markdown || "";

      // Extract incident type from content
      const typeMatch = pdfContent.match(/Type:\s*([^\n]+)/i);
      const incidentTypeText = typeMatch ? typeMatch[1].trim() : release.filename;
      
      // Extract date
      const dateMatch = pdfContent.match(/Date:\s*([^\n]+)/i);
      let startedAt = new Date().toISOString();
      if (dateMatch) {
        const parsed = new Date(dateMatch[1].trim());
        if (!isNaN(parsed.getTime())) {
          startedAt = parsed.toISOString();
        }
      }

      // Build title
      const title = `${incidentTypeText} - Walworth County (${incidentNumber})`.substring(0, 140);
      const typeInfo = inferIncidentType(incidentTypeText + ' ' + pdfContent);

      // Get description from narrative
      const narrativeMatch = pdfContent.match(/Narrative\s*([\s\S]*?)(?:\n\n|$)/i);
      const description = narrativeMatch 
        ? narrativeMatch[1].trim().substring(0, 500) 
        : `Sheriff's news release for incident ${incidentNumber}`;

      const slug = slugify(title) + '-' + Date.now().toString(36);

      // Insert incident
      const { data: newIncident, error: insertError } = await supabase
        .from("incidents")
        .insert({
          slug,
          title,
          incident_type: typeInfo.type,
          sub_type: incidentTypeText.toLowerCase().replace(/\s+/g, '_').substring(0, 50),
          status: 'resolved', // Sheriff releases are usually after-the-fact
          priority_score: typeInfo.priority,
          started_at: startedAt,
          location: 'Walworth County',
          source: 'sheriff',
          external_id: externalId,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[sync-sheriff] Insert error:`, insertError);
        results.errors.push(insertError.message);
        continue;
      }

      // Add incident update with the full content
      await supabase.from("incident_updates").insert({
        incident_id: newIncident.id,
        source: 'sheriff',
        source_label: 'Walworth County Sheriff',
        text: description,
        is_verified: true,
      });

      console.log(`[sync-sheriff] ✅ Created: ${title.substring(0, 60)}`);
      results.inserted++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[sync-sheriff] Complete:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[sync-sheriff] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
