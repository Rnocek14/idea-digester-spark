import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IncidentType = 'crime' | 'police' | 'accident' | 'other';

// SpotCrime crime type mapping
const CRIME_TYPE_MAP: Record<string, IncidentType> = {
  'theft': 'crime',
  'burglary': 'crime',
  'robbery': 'crime',
  'assault': 'crime',
  'vandalism': 'crime',
  'arrest': 'police',
  'shooting': 'police',
  'arson': 'crime',
  'other': 'crime',
};

// Lake Geneva area keywords for filtering
const LAKE_GENEVA_KEYWORDS = [
  'lake geneva', 'williams bay', 'fontana', 'walworth', 'elkhorn',
  'delavan', 'genoa city', 'sharon', 'darien', 'east troy',
];

function inferCrimeType(text: string): IncidentType {
  const lower = text.toLowerCase();
  if (lower.includes('theft') || lower.includes('larceny') || lower.includes('shoplifting')) return 'crime';
  if (lower.includes('burglary') || lower.includes('break-in') || lower.includes('breaking')) return 'crime';
  if (lower.includes('robbery')) return 'crime';
  if (lower.includes('assault') || lower.includes('battery')) return 'crime';
  if (lower.includes('vandalism') || lower.includes('criminal damage')) return 'crime';
  if (lower.includes('arrest') || lower.includes('warrant')) return 'police';
  if (lower.includes('shooting') || lower.includes('shots fired')) return 'police';
  if (lower.includes('arson') || lower.includes('fire')) return 'crime';
  if (lower.includes('crash') || lower.includes('accident') || lower.includes('collision')) return 'accident';
  return 'crime';
}

function calculatePriorityScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 4; // Base score for crimes
  
  if (lower.includes('shooting') || lower.includes('shots fired')) score = 8;
  else if (lower.includes('robbery') || lower.includes('armed')) score = 7;
  else if (lower.includes('assault') || lower.includes('battery')) score = 6;
  else if (lower.includes('burglary') || lower.includes('break-in')) score = 5;
  else if (lower.includes('theft') || lower.includes('larceny')) score = 4;
  else if (lower.includes('vandalism')) score = 3;
  
  return score;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function isLakeGenevaArea(text: string): boolean {
  const lower = text.toLowerCase();
  return LAKE_GENEVA_KEYWORDS.some(kw => lower.includes(kw));
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
    };

    console.log("[sync-spotcrime] Scraping Walworth County crime data...");

    // Scrape SpotCrime Walworth County page
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://spotcrime.com/WI/Walworth%20County",
        formats: ["markdown"],
        waitFor: 3000,
        onlyMainContent: true,
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

    if (!markdown || markdown.length < 100) {
      console.warn("[sync-spotcrime] Empty/short markdown received");
      return new Response(
        JSON.stringify({ success: true, message: "No content found", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-spotcrime] Received ${markdown.length} chars of markdown`);

    // Log sample content for debugging
    const lines = markdown.split('\n').filter(l => l.trim().length > 10);
    console.log(`[sync-spotcrime] Sample lines (first 5):`);
    lines.slice(0, 5).forEach((l, i) => console.log(`  ${i}: ${l.substring(0, 100)}`));

    // SpotCrime formats vary - look for patterns that indicate crime entries
    // Common patterns: addresses, dates, crime type icons converted to text
    const crimeIndicators = [
      'theft', 'burglary', 'robbery', 'assault', 'vandalism', 'arrest',
      'shooting', 'arson', 'larceny', 'battery', 'breaking', 'stolen',
      'criminal', 'damage', 'trespass', 'disorder', 'weapon', 'drug'
    ];
    
    // Also look for address patterns which indicate crime entries
    const addressPattern = /\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Dr|Blvd|Ln|Way|Ct|Circle|Hwy)/i;
    
    for (const line of lines) {
      results.processed++;
      const lower = line.toLowerCase();
      
      // Check for crime indicators OR address patterns
      const hasCrimeKeyword = crimeIndicators.some(kw => lower.includes(kw));
      const hasAddress = addressPattern.test(line);
      
      if (!hasCrimeKeyword && !hasAddress) {
        results.skipped++;
        continue;
      }

      // If has address but no crime keyword, it might still be a crime entry - log it
      if (hasAddress && !hasCrimeKeyword) {
        console.log(`[sync-spotcrime] Address line without keyword: ${line.substring(0, 80)}`);
      }

      // Check if it's in Lake Geneva area
      if (!isLakeGenevaArea(line)) {
        results.filtered_out++;
        continue;
      }

      // Extract a title and location
      const title = line.trim().substring(0, 140);
      const slug = slugifyTitle(title) + '-' + Date.now().toString(36);
      const incidentType = inferCrimeType(line);
      const priorityScore = calculatePriorityScore(line);

      // Check for duplicates (similar title in last 24h)
      const { data: existing } = await supabase
        .from("incidents")
        .select("id")
        .ilike("title", `%${title.substring(0, 40)}%`)
        .gte("started_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[sync-spotcrime] Skipping duplicate: ${title.substring(0, 50)}`);
        results.skipped++;
        continue;
      }

      // Insert the incident
      const { error: insertError } = await supabase.from("incidents").insert({
        slug,
        title,
        incident_type: incidentType,
        status: 'active',
        priority_score: priorityScore,
        started_at: new Date().toISOString(),
        location: 'Walworth County',
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
