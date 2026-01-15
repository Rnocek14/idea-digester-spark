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

// Extract PDF/release links from HTML
function extractReleaseLinks(html: string): Array<{ id: string; filename: string; url: string }> {
  const releases: Array<{ id: string; filename: string; url: string }> = [];
  
  // Look for DocumentCenter PDF links (news releases)
  const pdfPattern = /DocumentCenter\/View\/(\d+)\/([^"'\s]+News-Release[^"'\s]*)/gi;
  let match;
  while ((match = pdfPattern.exec(html)) !== null) {
    releases.push({
      id: match[1],
      filename: match[2],
      url: `https://www.co.walworth.wi.us/DocumentCenter/View/${match[1]}/${match[2]}`,
    });
  }
  
  // Also look for generic PDF links
  const genericPattern = /href=["']([^"']*DocumentCenter\/View\/\d+[^"']*)["']/gi;
  while ((match = genericPattern.exec(html)) !== null) {
    const urlMatch = match[1].match(/DocumentCenter\/View\/(\d+)\/([^"'\s?#]+)/);
    if (urlMatch && urlMatch[2].toLowerCase().includes('news')) {
      const exists = releases.some(r => r.id === urlMatch[1]);
      if (!exists) {
        releases.push({
          id: urlMatch[1],
          filename: urlMatch[2],
          url: match[1].startsWith('http') ? match[1] : `https://www.co.walworth.wi.us${match[1]}`,
        });
      }
    }
  }
  
  return releases;
}

// Rate limiter for concurrent requests
async function rateLimitedFetch<T>(
  items: T[],
  fetcher: (item: T, index: number) => Promise<any>,
  concurrency: number = 3,
  delayMs: number = 500
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, idx) => fetcher(item, i + idx))
    );
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
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
      skipped: 0,
      errors: [] as string[],
      releases_found: [] as string[],
      static_fetch_used: true,
      firecrawl_used: false,
    };

    console.log("[sync-sheriff] Fetching Walworth County Sheriff news releases...");

    // Step 1: Static fetch for the index page first
    let html = "";
    const indexUrl = "https://www.co.walworth.wi.us/747/News-Releases";
    
    try {
      console.log("[sync-sheriff] Attempting static fetch of index page...");
      const staticRes = await fetch(indexUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      
      if (staticRes.ok) {
        html = await staticRes.text();
        console.log(`[sync-sheriff] Static fetch success: ${html.length} chars`);
      }
    } catch (err) {
      console.log("[sync-sheriff] Static fetch failed:", err);
    }

    // Step 2: If static fetch didn't work, use scrape-content with firecrawl fallback
    if (html.length < 500 || !html.includes('DocumentCenter')) {
      console.log("[sync-sheriff] Content insufficient, using scrape-content...");
      
      const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: indexUrl,
          extract_type: "article", // Use article for index pages
          use_firecrawl: true,
        }),
      });
      
      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        console.error("[sync-sheriff] scrape-content error:", scrapeResponse.status, errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to scrape index page" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const scrapeData = await scrapeResponse.json();
      results.firecrawl_used = scrapeData.used_firecrawl || false;
      results.static_fetch_used = !results.firecrawl_used;
      
      // Get raw HTML if available
      html = scrapeData.html || scrapeData.raw_html || "";
      
      if (html.length < 200) {
        console.error("[sync-sheriff] No HTML content from scrape-content");
        return new Response(
          JSON.stringify({ success: false, error: "No content from scrape" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 3: Extract release PDF links
    const foundReleases = extractReleaseLinks(html);
    const uniqueReleases = Array.from(new Map(foundReleases.map(r => [r.id, r])).values());
    
    console.log(`[sync-sheriff] Found ${uniqueReleases.length} unique news releases`);
    results.releases_found = uniqueReleases.map(r => r.filename);

    // Step 4: Process each release (limit to most recent 5)
    const releasesToProcess = uniqueReleases.slice(0, 5);
    
    const releaseDetails = await rateLimitedFetch(
      releasesToProcess,
      async (release) => {
        results.processed++;
        
        // Extract incident number from filename
        const incidentMatch = release.filename.match(/(\d{2}-\d{5,6})/);
        const incidentNumber = incidentMatch ? incidentMatch[1] : null;

        if (!incidentNumber) {
          console.log(`[sync-sheriff] No incident number in: ${release.filename}`);
          return { release, skipped: true, reason: "no_incident_number" };
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
          return { release, skipped: true, reason: "duplicate", incidentNumber };
        }

        // Use scrape-content to extract incident details from the PDF page
        console.log(`[sync-sheriff] Extracting details: ${release.url}`);
        
        const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: release.url,
            extract_type: "incident",
            use_firecrawl: true, // PDFs often need rendering
          }),
        });

        if (!scrapeResponse.ok) {
          return { release, error: `HTTP ${scrapeResponse.status}`, incidentNumber };
        }

        const scrapeData = await scrapeResponse.json();
        if (scrapeData.used_firecrawl) {
          results.firecrawl_used = true;
        }

        return { 
          release, 
          incidentNumber, 
          externalId,
          data: scrapeData.success ? scrapeData.data : null,
          rawContent: scrapeData.raw_content,
        };
      },
      2, // Max 2 concurrent (PDFs are heavier)
      1000 // 1s delay between batches
    );

    // Step 5: Insert extracted incidents
    for (const result of releaseDetails) {
      if (result.skipped) {
        results.skipped++;
        continue;
      }
      
      if (result.error) {
        results.errors.push(`${result.release.filename}: ${result.error}`);
        continue;
      }

      const extracted = result.data || {};
      const incidentNumber = result.incidentNumber;
      const externalId = result.externalId;
      
      // Build title from extracted data or filename
      const incidentTypeText = extracted.incident_type || result.release.filename.replace(/-/g, ' ');
      const title = `${incidentTypeText} - Walworth County (${incidentNumber})`.substring(0, 140);
      const typeInfo = inferIncidentType(incidentTypeText + ' ' + (extracted.description || ''));

      // Get date from extraction or use now
      let startedAt = new Date().toISOString();
      if (extracted.incident_time) {
        const parsed = new Date(extracted.incident_time);
        if (!isNaN(parsed.getTime())) {
          startedAt = parsed.toISOString();
        }
      }

      const description = extracted.description || `Sheriff's news release for incident ${incidentNumber}`;
      const slug = slugify(title) + '-' + Date.now().toString(36);

      // Insert incident
      const { data: newIncident, error: insertError } = await supabase
        .from("incidents")
        .insert({
          slug,
          title,
          incident_type: typeInfo.type,
          sub_type: (extracted.sub_type || incidentTypeText).toLowerCase().replace(/\s+/g, '_').substring(0, 50),
          status: 'resolved', // Sheriff releases are usually after-the-fact
          priority_score: typeInfo.priority,
          started_at: startedAt,
          location: extracted.location || 'Walworth County',
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

      // Add incident update with structured details
      const updateParts: string[] = [];
      if (extracted.location) updateParts.push(`📍 Location: ${extracted.location}`);
      if (extracted.incident_time) updateParts.push(`⏰ Time: ${extracted.incident_time}`);
      if (extracted.responding_agencies?.length > 0) updateParts.push(`🚨 Responding: ${extracted.responding_agencies.join(", ")}`);
      if (extracted.injuries) updateParts.push(`🏥 Injuries: ${extracted.injuries}`);
      if (extracted.fatalities !== null && extracted.fatalities !== undefined) updateParts.push(`⚠️ Fatalities: ${extracted.fatalities}`);
      if (extracted.road_status) updateParts.push(`🚗 Road: ${extracted.road_status}`);
      if (extracted.suspect_status) updateParts.push(`👮 Suspect: ${extracted.suspect_status}`);

      await supabase.from("incident_updates").insert({
        incident_id: newIncident.id,
        source: 'sheriff',
        source_label: 'Walworth County Sheriff',
        text: updateParts.length > 0 ? updateParts.join("\n") : description.substring(0, 500),
        is_verified: true,
      });

      console.log(`[sync-sheriff] ✅ Created: ${title.substring(0, 60)}`);
      results.inserted++;
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
