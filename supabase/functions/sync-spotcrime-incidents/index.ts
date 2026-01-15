import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IncidentType = 'crime' | 'police' | 'accident' | 'other';

// Lake Geneva area keywords for filtering
const LAKE_GENEVA_KEYWORDS = [
  'lake geneva', 'williams bay', 'fontana', 'walworth', 'elkhorn',
  'delavan', 'genoa city', 'sharon', 'darien', 'east troy',
];

// Crime type mapping
const CRIME_TYPE_MAP: Record<string, { type: IncidentType; priority: number }> = {
  'shooting': { type: 'police', priority: 8 },
  'shots fired': { type: 'police', priority: 8 },
  'robbery': { type: 'crime', priority: 7 },
  'armed robbery': { type: 'crime', priority: 8 },
  'assault': { type: 'crime', priority: 6 },
  'battery': { type: 'crime', priority: 6 },
  'burglary': { type: 'crime', priority: 5 },
  'breaking': { type: 'crime', priority: 5 },
  'theft': { type: 'crime', priority: 4 },
  'larceny': { type: 'crime', priority: 4 },
  'shoplifting': { type: 'crime', priority: 3 },
  'vandalism': { type: 'crime', priority: 3 },
  'criminal damage': { type: 'crime', priority: 3 },
  'arrest': { type: 'police', priority: 4 },
  'arson': { type: 'crime', priority: 7 },
};

function inferCrimeInfo(text: string): { type: IncidentType; subType: string; priority: number } {
  const lower = text.toLowerCase();
  
  for (const [keyword, info] of Object.entries(CRIME_TYPE_MAP)) {
    if (lower.includes(keyword)) {
      return { type: info.type, subType: keyword.replace(/\s+/g, '_'), priority: info.priority };
    }
  }
  
  return { type: 'crime', subType: 'other', priority: 3 };
}

function isLakeGenevaArea(text: string): { isLocal: boolean; geoTier: number; geoLabel: string } {
  const lower = text.toLowerCase();
  
  if (lower.includes('lake geneva')) {
    return { isLocal: true, geoTier: 1, geoLabel: 'Lake Geneva' };
  }
  
  if (LAKE_GENEVA_KEYWORDS.some(kw => lower.includes(kw))) {
    return { isLocal: true, geoTier: 2, geoLabel: 'Walworth County' };
  }
  
  return { isLocal: false, geoTier: 0, geoLabel: '' };
}

// Simple hash for deduplication
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Rate limiter for concurrent requests
async function rateLimitedFetch<T>(
  items: T[],
  fetcher: (item: T) => Promise<any>,
  concurrency: number = 3,
  delayMs: number = 300
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fetcher));
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
      filtered_out: 0,
      errors: [] as string[],
      static_fetch_used: true,
      firecrawl_used: false,
    };

    console.log("[sync-spotcrime] Scraping Walworth County crime data...");

    const spotcrimeUrl = "https://spotcrime.com/WI/Walworth%20County";

    // Step 1: Use scrape-content for the main page (SpotCrime is JS-heavy)
    // SpotCrime almost always needs JS rendering, so we go straight to scrape-content
    console.log("[sync-spotcrime] Using scrape-content with firecrawl fallback...");
    
    const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-content`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: spotcrimeUrl,
        extract_type: "incident", // Use incident schema
        use_firecrawl: true, // SpotCrime requires JS rendering
      }),
    });

    if (!scrapeResponse.ok) {
      const errText = await scrapeResponse.text();
      console.error("[sync-spotcrime] scrape-content error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to scrape SpotCrime" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    results.firecrawl_used = scrapeData.used_firecrawl || false;
    results.static_fetch_used = !results.firecrawl_used;

    console.log(`[sync-spotcrime] scrape-content success (firecrawl: ${results.firecrawl_used})`);

    // Get raw content for additional parsing
    const rawContent = scrapeData.raw_content || "";
    const html = scrapeData.html || "";
    
    console.log(`[sync-spotcrime] Content length: raw=${rawContent.length}, html=${html.length}`);

    // Step 2: Try to extract individual crime entries
    // SpotCrime typically has crime data in JSON format or structured markers
    const incidents: Array<{
      type: string;
      address: string;
      date: string;
      description: string;
    }> = [];

    // Pattern 1: Look for crime marker data in HTML/JSON
    const markerPattern = /"type"\s*:\s*"([^"]+)".*?"address"\s*:\s*"([^"]+)".*?"date"\s*:\s*"([^"]+)"/gi;
    let markerMatch;
    while ((markerMatch = markerPattern.exec(html)) !== null) {
      incidents.push({
        type: markerMatch[1],
        address: markerMatch[2],
        date: markerMatch[3],
        description: `${markerMatch[1]} at ${markerMatch[2]}`,
      });
    }

    // Pattern 2: Parse from structured content
    const contentLines = rawContent.split('\n').filter((l: string) => l.trim().length > 15);
    const crimeKeywords = [
      'theft', 'burglary', 'robbery', 'assault', 'vandalism', 'arrest',
      'shooting', 'arson', 'larceny', 'battery', 'breaking', 'stolen',
      'criminal', 'damage', 'trespass', 'disorder', 'weapon', 'drug'
    ];
    
    for (const line of contentLines) {
      const lower = line.toLowerCase();
      const hasCrimeKeyword = crimeKeywords.some(kw => lower.includes(kw));
      
      if (hasCrimeKeyword && !incidents.some(i => i.description === line.trim())) {
        incidents.push({
          type: 'crime',
          address: line.trim(),
          date: new Date().toISOString(),
          description: line.trim(),
        });
      }
    }

    // If we got structured data from AI extraction, add those too
    if (scrapeData.success && scrapeData.data) {
      const extracted = scrapeData.data;
      if (extracted.location && extracted.description) {
        incidents.push({
          type: extracted.incident_type || 'crime',
          address: extracted.location,
          date: extracted.incident_time || new Date().toISOString(),
          description: extracted.description,
        });
      }
    }

    console.log(`[sync-spotcrime] Found ${incidents.length} potential incidents`);

    // Step 3: Process each incident (limit to 30 per run)
    const incidentsToProcess = incidents.slice(0, 30);
    
    for (const inc of incidentsToProcess) {
      results.processed++;
      
      // Check if in Lake Geneva area
      const geoInfo = isLakeGenevaArea(inc.address + ' ' + inc.description);
      if (!geoInfo.isLocal) {
        results.filtered_out++;
        continue;
      }

      const crimeInfo = inferCrimeInfo(inc.type + ' ' + inc.description);
      const title = `${crimeInfo.subType.replace(/_/g, ' ')} in ${geoInfo.geoLabel}`.substring(0, 140);
      
      // Create external_id for deduplication (1-hour buckets)
      const timeBucket = Math.floor(Date.now() / (60 * 60 * 1000));
      const addressNorm = inc.address.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
      const externalId = await hashString(`${crimeInfo.subType}|${addressNorm}|${timeBucket}`);

      // Check for existing incident
      const { data: existing } = await supabase
        .from("incidents")
        .select("id")
        .eq("source", "spotcrime")
        .eq("external_id", externalId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[sync-spotcrime] Skipping duplicate: ${title.substring(0, 50)}`);
        results.skipped++;
        continue;
      }

      const slug = slugify(title) + '-' + Date.now().toString(36);

      // Insert the incident
      const { error: insertError } = await supabase.from("incidents").insert({
        slug,
        title,
        incident_type: crimeInfo.type,
        sub_type: crimeInfo.subType,
        status: 'active',
        priority_score: crimeInfo.priority,
        started_at: inc.date || new Date().toISOString(),
        location: geoInfo.geoLabel,
        source: 'spotcrime',
        external_id: externalId,
      });

      if (insertError) {
        console.error(`[sync-spotcrime] Insert error:`, insertError);
        results.errors.push(insertError.message);
      } else {
        console.log(`[sync-spotcrime] ✅ Created: ${title.substring(0, 60)}`);
        results.inserted++;
      }

      // Small delay between inserts
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[sync-spotcrime] Complete:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[sync-spotcrime] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
