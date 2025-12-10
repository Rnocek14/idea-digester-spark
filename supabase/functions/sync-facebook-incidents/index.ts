import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IncidentType = 'accident' | 'fire' | 'weather' | 'police' | 'crime' | 'road_closure' | 'other';

type FBSourceConfig = {
  id: string;
  name: string;
  url: string;
  geo_label: string;
  geo_tier: number;
};

const FACEBOOK_SOURCES: FBSourceConfig[] = [
  {
    id: "lake_geneva_pd",
    name: "Lake Geneva Police Department",
    url: "https://www.facebook.com/LakeGenevaPolice/",
    geo_label: "Lake Geneva",
    geo_tier: 1,
  },
  {
    id: "walworth_sheriff",
    name: "Walworth County Sheriff's Office",
    url: "https://www.facebook.com/WalCoSheriff/",
    geo_label: "Walworth County",
    geo_tier: 2,
  },
];

// Keywords that signal an incident post
const INCIDENT_SIGNALS = [
  'crash', 'accident', 'collision', 'rollover', 'fatality',
  'structure fire', 'house fire', 'fire department', 'fire call',
  'shots fired', 'shooting', 'armed', 'standoff', 'manhunt',
  'arrest', 'arrested', 'robbery', 'burglary', 'assault',
  'avoid the area', 'road closed', 'closure', 'lane closed',
  'traffic alert', 'major incident', 'breaking', 'emergency',
  'responding to', 'officers on scene', 'investigation',
];

// Keywords to exclude (non-incident posts)
const EXCLUSION_KEYWORDS = [
  'coffee with a cop', 'national', 'awareness month', 'memorial',
  'hiring', 'job opening', 'recruitment', 'congratulations',
  'happy birthday', 'thank you', 'appreciation', 'training',
  'tip tuesday', 'safety tip', 'reminder', 'community event',
];

function inferIncidentType(text: string): IncidentType {
  const t = text.toLowerCase();

  if (t.includes('crash') || t.includes('accident') || t.includes('collision') || t.includes('rollover') || t.includes('pedestrian struck')) {
    return 'accident';
  }
  if (t.includes('structure fire') || t.includes('house fire') || t.includes('building fire') || t.includes('fire call')) {
    return 'fire';
  }
  if (t.includes('road closed') || t.includes('closure') || t.includes('detour') || t.includes('lane closed')) {
    return 'road_closure';
  }
  if (t.includes('shots fired') || t.includes('shooting') || t.includes('armed') || t.includes('standoff') || t.includes('manhunt')) {
    return 'police';
  }
  if (t.includes('arrest') || t.includes('robbery') || t.includes('burglary') || t.includes('assault') || t.includes('theft')) {
    return 'crime';
  }
  if (t.includes('storm') || t.includes('tornado') || t.includes('flood') || t.includes('weather')) {
    return 'weather';
  }

  return 'other';
}

function determinePriorityScore(text: string): number {
  const t = text.toLowerCase();
  let score = 3; // base

  if (t.includes('fatal') || t.includes('death') || t.includes('killed')) score += 4;
  if (t.includes('shooting') || t.includes('shots fired')) score += 3;
  if (t.includes('crash') || t.includes('accident')) score += 2;
  if (t.includes('major') || t.includes('serious') || t.includes('critical')) score += 2;
  if (t.includes('avoid the area') || t.includes('active scene')) score += 2;
  if (t.includes('closure') || t.includes('closed')) score += 1;
  if (t.includes('highway') || t.includes('hwy') || t.includes('interstate')) score += 1;

  return Math.min(score, 10);
}

function extractTitle(chunk: string): string {
  // Get first line/sentence as title
  const firstLine = chunk.split('\n')[0].trim();
  const firstSentence = firstLine.split(/[.!?]/)[0].trim();
  const title = (firstSentence || firstLine).slice(0, 120);
  
  // Clean up markdown artifacts
  return title.replace(/^\*+\s*/, '').replace(/\*+$/, '').replace(/^\#+\s*/, '');
}

function extractLocation(chunk: string): string | null {
  const t = chunk;
  
  // Try to find location patterns
  const patterns = [
    /(?:at|near|on|by)\s+(\d+\s+[A-Z][a-zA-Z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Hwy|Highway|Ln|Lane))/i,
    /(?:at|near|on)\s+(Highway\s+\d+|Hwy\s+\d+|US-?\d+|I-?\d+)/i,
    /(?:at|near|on)\s+([A-Z][a-zA-Z]+\s+(?:and|&)\s+[A-Z][a-zA-Z]+)/i,
    /(\d{4,5}\s+block\s+of\s+[A-Z][a-zA-Z\s]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = t.match(pattern);
    if (match) {
      return match[1].slice(0, 200);
    }
  }
  
  return null;
}

function generateSlug(title: string, sourceId: string): string {
  const slugTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  
  return `${sourceId}-${slugTitle}-${Date.now()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-facebook-incidents] Starting Facebook PD/Sheriff scrape...');

    const results = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const source of FACEBOOK_SOURCES) {
      console.log(`[sync-facebook-incidents] Scraping ${source.name}...`);

      try {
        // Scrape the page with Firecrawl
        const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: source.url,
            formats: ['markdown'],
            waitFor: 4000,
            onlyMainContent: true,
          }),
        });

        if (!fcRes.ok) {
          const errorText = await fcRes.text();
          console.error(`[sync-facebook-incidents] Firecrawl error for ${source.name}:`, errorText.substring(0, 300));
          results.errors.push(`Firecrawl failed for ${source.id}`);
          continue;
        }

        const fcData = await fcRes.json();
        const markdown: string = fcData.data?.markdown || '';

        console.log(`[sync-facebook-incidents] Got ${markdown.length} chars from ${source.name}`);

        if (markdown.length < 200) {
          console.warn(`[sync-facebook-incidents] Too short content from ${source.name}`);
          continue;
        }

        // Split into potential posts (Facebook markdown often has double newlines between posts)
        const rawChunks = markdown
          .split(/\n{2,}/g)
          .map((chunk: string) => chunk.trim())
          .filter((chunk: string) => chunk.length > 100 && chunk.length < 3000);

        console.log(`[sync-facebook-incidents] Found ${rawChunks.length} chunks from ${source.name}`);

        // Get existing incident titles to avoid duplicates
        const { data: existingIncidents } = await supabase
          .from('incidents')
          .select('title')
          .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const existingTitles = new Set(
          (existingIncidents || []).map(i => i.title.toLowerCase().substring(0, 50))
        );

        for (const chunk of rawChunks) {
          results.processed++;
          const lower = chunk.toLowerCase();

          // Check for exclusions first
          if (EXCLUSION_KEYWORDS.some(kw => lower.includes(kw))) {
            results.skipped++;
            continue;
          }

          // Check for incident signals
          const hasSignal = INCIDENT_SIGNALS.some(kw => lower.includes(kw));
          if (!hasSignal) {
            results.skipped++;
            continue;
          }

          const incidentType = inferIncidentType(chunk);
          if (incidentType === 'other') {
            results.skipped++;
            continue;
          }

          const title = extractTitle(chunk);
          if (!title || title.length < 10) {
            results.skipped++;
            continue;
          }

          // Check for duplicate by title prefix
          const titlePrefix = title.toLowerCase().substring(0, 50);
          if (existingTitles.has(titlePrefix)) {
            console.log(`[sync-facebook-incidents] Skipping duplicate: ${title.substring(0, 40)}...`);
            results.skipped++;
            continue;
          }

          const location = extractLocation(chunk) || source.geo_label;
          const priorityScore = determinePriorityScore(chunk);
          const slug = generateSlug(title, source.id);

          // Insert incident
          const { data: incident, error: insertError } = await supabase
            .from('incidents')
            .insert({
              title,
              incident_type: incidentType,
              location,
              status: 'active',
              priority_score: priorityScore,
              slug,
              started_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`[sync-facebook-incidents] Insert error:`, insertError);
            results.errors.push(`Insert failed: ${title.substring(0, 30)}`);
            continue;
          }

          // Add initial update with full description
          if (incident) {
            await supabase.from('incident_updates').insert({
              incident_id: incident.id,
              text: chunk.slice(0, 2000),
              source: 'facebook',
              source_label: source.name,
              is_verified: true,
            });

            existingTitles.add(titlePrefix);
            results.inserted++;
            console.log(`[sync-facebook-incidents] ✅ Created: ${title.substring(0, 50)}... (${incidentType})`);
          }

          // Small delay
          await new Promise(r => setTimeout(r, 300));
        }

      } catch (sourceError: any) {
        console.error(`[sync-facebook-incidents] Error processing ${source.name}:`, sourceError.message);
        results.errors.push(`${source.id}: ${sourceError.message}`);
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'source',
      action: 'sync_completed',
      actor_type: 'system',
      message: `Facebook PD/Sheriff: ${results.inserted} incidents, ${results.skipped} skipped`,
      details: results,
    });

    console.log(`[sync-facebook-incidents] Complete: ${results.inserted} inserted, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-facebook-incidents] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
