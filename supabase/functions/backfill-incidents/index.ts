import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Infer incident type from story content
type IncidentType = 'accident' | 'fire' | 'weather' | 'police' | 'utility' | 'crime' | 'road_closure' | 'other';

// Keywords that should ALWAYS create incidents (regardless of priority score threshold)
const INCIDENT_KEYWORDS = {
  accident: ['crash', 'accident', 'collision', 'rollover', 'hit and run', 'pedestrian struck', 'fatality'],
  fire: ['structure fire', 'house fire', 'building fire', 'fire department responds', 'fire call', 'flames'],
  police: ['police respond', 'shots fired', 'shooting', 'standoff', 'swat', 'armed', 'hostage', 'manhunt'],
  crime: ['arrest', 'arrested', 'robbery', 'burglary', 'assault', 'homicide', 'stabbing', 'carjacking'],
  utility: ['power outage', 'water main break', 'gas leak', 'boil water', 'utility emergency'],
  road_closure: ['road closed', 'closure', 'detour', 'bridge closed', 'highway closed'],
  weather: ['tornado', 'severe storm', 'flooding', 'blizzard', 'winter storm warning'],
};

function inferIncidentType(story: {
  category?: string | null;
  title?: string | null;
  summary?: string | null;
}): IncidentType {
  const category = (story.category || '').toLowerCase();
  const text = `${story.title || ''} ${story.summary || ''}`.toLowerCase();

  // Check each incident type's keywords
  for (const [type, keywords] of Object.entries(INCIDENT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return type as IncidentType;
    }
  }

  // Fallback checks
  if (category.includes('weather')) return 'weather';
  if (category.includes('traffic')) return 'accident';
  if (category === 'safety' || category === 'crime') return 'police';
  
  return 'other';
}

// Generate URL-friendly slug
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Check if story should be excluded (court proceedings, memorials, etc.)
function shouldExclude(title: string, summary: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();
  
  // Court proceedings / legal outcomes
  if (/sentenced|pleads guilty|convicted|charged with|arraigned|verdict|prison/.test(text)) {
    // Check if this is about an ACTIVE arrest vs a sentencing
    if (/sentenced|pleads guilty|convicted|verdict|prison|years in prison/.test(text)) {
      return true; // Past legal proceeding
    }
  }
  
  // Memorial / grieving content
  if (/grieves|mourns|memorial|obituary|funeral|in memory/.test(text)) {
    return true;
  }
  
  // Fire department operations (not actual fires)
  if (/fire department|fire chief|fire station|fire prevention|training|drill|expands support|study flags/.test(text)) {
    return true;
  }
  
  // Events/entertainment
  if (/ladies night|live music|dj |karaoke|concert|festival/.test(text)) {
    return true;
  }
  
  return false;
}

// Check freshness
function isFresh(publishDate: string | null, daysThreshold: number = 30): boolean {
  if (!publishDate) return false;
  try {
    const published = new Date(publishDate);
    const now = new Date();
    const diffDays = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= daysThreshold;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dry_run = true, min_priority = 5, days_back = 30 } = await req.json().catch(() => ({}));

    console.log(`[backfill-incidents] Starting with dry_run=${dry_run}, min_priority=${min_priority}, days_back=${days_back}`);

    // Find high-priority stories that don't have incidents linked
    // CRITICAL: Only geo_tier 1 or 2 stories can become incidents (hyperlocal/county)
    const { data: stories, error: storiesError } = await supabase
      .from("content_queue")
      .select("id, title, summary, category, priority_score, publish_date, created_at, geo_tier, geo_label")
      .gte("priority_score", min_priority)
      .gte("geo_tier", 1) // Only hyperlocal (1) or county (2) - never regional (0)
      .eq("is_breaking", false)
      .gte("created_at", new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString())
      .order("priority_score", { ascending: false })
      .limit(50);

    if (storiesError) {
      throw new Error(`Error fetching stories: ${storiesError.message}`);
    }

    console.log(`[backfill-incidents] Found ${stories?.length || 0} high-priority stories to evaluate`);

    const results: Array<{
      title: string;
      priority: number;
      action: string;
      incident_id?: string;
    }> = [];

    for (const story of stories || []) {
      // Check exclusions
      if (shouldExclude(story.title, story.summary || '')) {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: 'EXCLUDED - matches exclusion pattern',
        });
        continue;
      }

      // Check freshness
      if (!isFresh(story.publish_date, days_back)) {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: 'EXCLUDED - too old',
        });
        continue;
      }

      const incidentType = inferIncidentType(story);
      
      // Skip "other" type - only create incidents for recognizable types
      if (incidentType === 'other') {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: 'EXCLUDED - incident type is "other"',
        });
        continue;
      }
      
      const slug = slugifyTitle(story.title);

      // Check if incident already exists for this story
      const { data: existingIncident } = await supabase
        .from("incidents")
        .select("id")
        .eq("source_story_id", story.id)
        .maybeSingle();

      if (existingIncident) {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: 'SKIPPED - incident already exists',
          incident_id: existingIncident.id,
        });
        continue;
      }

      // Check if similar incident exists by title matching
      const titleWords = story.title.split(' ').slice(0, 4).join(' ');
      const { data: similarIncidents } = await supabase
        .from("incidents")
        .select("id, title")
        .eq("incident_type", incidentType)
        .ilike("title", `%${titleWords}%`)
        .limit(1);

      if (similarIncidents && similarIncidents.length > 0) {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: `SKIPPED - similar incident exists: "${similarIncidents[0].title.substring(0, 40)}..."`,
          incident_id: similarIncidents[0].id,
        });
        continue;
      }

      // This story should create a new incident
      if (dry_run) {
        results.push({
          title: story.title.substring(0, 50),
          priority: story.priority_score,
          action: `WOULD CREATE - ${incidentType} incident`,
        });
      } else {
        // Create the incident
        const { data: newIncident, error: insertError } = await supabase
          .from("incidents")
          .insert({
            slug,
            title: story.title,
            incident_type: incidentType,
            status: 'resolved', // Historical incidents start as resolved
            source_story_id: story.id,
            priority_score: story.priority_score,
            started_at: story.publish_date || story.created_at,
          })
          .select("id")
          .single();

        if (insertError) {
          results.push({
            title: story.title.substring(0, 50),
            priority: story.priority_score,
            action: `ERROR - ${insertError.message}`,
          });
        } else {
          // Add initial update
          await supabase.from("incident_updates").insert({
            incident_id: newIncident.id,
            source: 'backfill',
            source_label: 'System Backfill',
            text: story.summary || story.title,
            is_verified: true,
            story_id: story.id,
          });

          // Mark story as breaking
          await supabase
            .from("content_queue")
            .update({ is_breaking: true })
            .eq("id", story.id);

          results.push({
            title: story.title.substring(0, 50),
            priority: story.priority_score,
            action: 'CREATED incident',
            incident_id: newIncident.id,
          });
        }
      }
    }

    const summary = {
      dry_run,
      total_evaluated: stories?.length || 0,
      would_create: results.filter(r => r.action.includes('WOULD CREATE')).length,
      created: results.filter(r => r.action === 'CREATED incident').length,
      excluded: results.filter(r => r.action.includes('EXCLUDED')).length,
      skipped: results.filter(r => r.action.includes('SKIPPED')).length,
    };

    console.log(`[backfill-incidents] Summary:`, summary);

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[backfill-incidents] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
