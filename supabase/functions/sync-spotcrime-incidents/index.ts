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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      console.error("[sync-spotcrime] FIRECRAWL_API_KEY not configured");
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
      filtered_out: 0,
      errors: [] as string[],
      sample_content: [] as string[],
    };

    console.log("[sync-spotcrime] Scraping Walworth County crime data...");

    // Try SpotCrime with both markdown and HTML
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://spotcrime.com/WI/Walworth%20County",
        formats: ["markdown", "html"],
        waitFor: 5000,  // Wait longer for JS to load
        onlyMainContent: false,  // Get full page
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text();
      console.error("[sync-spotcrime] Firecrawl error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcData = await fcRes.json();
    const markdown: string = fcData.data?.markdown || "";
    const html: string = fcData.data?.html || "";

    console.log(`[sync-spotcrime] Received markdown: ${markdown.length} chars, html: ${html.length} chars`);

    // Try to parse crime data from HTML using regex patterns
    // SpotCrime typically has crime markers with data attributes or structured elements
    const incidents: Array<{
      type: string;
      address: string;
      date: string;
      description: string;
    }> = [];

    // Pattern 1: Look for crime marker data in HTML
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

    // Pattern 2: Look for structured crime list items
    const listPattern = /<div[^>]*class="[^"]*crime[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>.*?<span[^>]*>([^<]+)<\/span>/gi;
    while ((markerMatch = listPattern.exec(html)) !== null) {
      incidents.push({
        type: markerMatch[1],
        address: markerMatch[2],
        date: new Date().toISOString(),
        description: `${markerMatch[1]} near ${markerMatch[2]}`,
      });
    }

    // Pattern 3: Parse markdown for crime entries
    const lines = markdown.split('\n').filter(l => l.trim().length > 15);
    
    // Log sample for debugging
    results.sample_content = lines.slice(0, 10).map(l => l.substring(0, 100));
    console.log("[sync-spotcrime] Sample markdown lines:", results.sample_content);

    // Crime keywords to detect in text
    const crimeKeywords = [
      'theft', 'burglary', 'robbery', 'assault', 'vandalism', 'arrest',
      'shooting', 'arson', 'larceny', 'battery', 'breaking', 'stolen',
      'criminal', 'damage', 'trespass', 'disorder', 'weapon', 'drug'
    ];
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      const hasCrimeKeyword = crimeKeywords.some(kw => lower.includes(kw));
      
      if (hasCrimeKeyword) {
        incidents.push({
          type: 'crime',
          address: line.trim(),
          date: new Date().toISOString(),
          description: line.trim(),
        });
      }
    }

    console.log(`[sync-spotcrime] Found ${incidents.length} potential incidents`);

    // Process each incident
    for (const inc of incidents) {
      results.processed++;
      
      // Check if in Lake Geneva area
      const geoInfo = isLakeGenevaArea(inc.address + ' ' + inc.description);
      if (!geoInfo.isLocal) {
        results.filtered_out++;
        continue;
      }

      const crimeInfo = inferCrimeInfo(inc.type + ' ' + inc.description);
      const title = `${crimeInfo.subType.replace(/_/g, ' ')} in ${geoInfo.geoLabel}`.substring(0, 140);
      
      // Create external_id for deduplication
      const timeBucket = Math.floor(Date.now() / (60 * 60 * 1000)); // 1-hour buckets
      const addressNorm = inc.address.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
      const externalId = await hashString(`${crimeInfo.subType}|${addressNorm}|${timeBucket}`);

      // Check for existing incident with same external_id
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

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
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
