import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Wisconsin 511 API endpoints - Walworth County area focus
const WI_511_API_BASE = 'https://511wi.gov/api/v2';

// Walworth County approximate bounding box
const WALWORTH_BOUNDS = {
  minLat: 42.4,
  maxLat: 42.7,
  minLon: -88.8,
  maxLon: -88.3,
};

// Keywords for local filtering
const LOCAL_KEYWORDS = [
  'lake geneva', 'walworth', 'fontana', 'williams bay', 'elkhorn', 'delavan',
  'highway 50', 'hwy 50', 'us-12', 'us 12', 'highway 12', 'hwy 12',
  'i-43', 'interstate 43', 'highway 43', 'state road 67', 'sr 67', 'hwy 67',
  'state road 120', 'sr 120', 'hwy 120', 'geneva lake', 'town of linn',
  'como', 'east troy', 'whitewater', 'burlington'
];

interface TrafficEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  location: string;
  lat?: number;
  lon?: number;
  startTime?: string;
  endTime?: string;
  severity?: string;
}

function isInWalworthArea(lat?: number, lon?: number, text?: string): boolean {
  // Check coordinates if available
  if (lat && lon) {
    if (lat >= WALWORTH_BOUNDS.minLat && lat <= WALWORTH_BOUNDS.maxLat &&
        lon >= WALWORTH_BOUNDS.minLon && lon <= WALWORTH_BOUNDS.maxLon) {
      return true;
    }
  }
  
  // Check text for local keywords
  if (text) {
    const lowerText = text.toLowerCase();
    return LOCAL_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
  
  return false;
}

function classifyIncidentType(event: TrafficEvent): string {
  const text = `${event.title} ${event.description} ${event.type}`.toLowerCase();
  
  if (text.includes('crash') || text.includes('accident') || text.includes('collision')) {
    return 'accident';
  }
  if (text.includes('closure') || text.includes('closed')) {
    return 'road_closure';
  }
  if (text.includes('construction') || text.includes('work zone')) {
    return 'construction';
  }
  if (text.includes('weather') || text.includes('ice') || text.includes('snow') || text.includes('flood')) {
    return 'weather';
  }
  if (text.includes('hazard') || text.includes('debris')) {
    return 'hazard';
  }
  return 'traffic';
}

function determineSeverity(event: TrafficEvent): number {
  const text = `${event.title} ${event.description}`.toLowerCase();
  let score = 2; // base score
  
  // Severity boosters
  if (text.includes('fatal') || text.includes('serious injury')) score += 4;
  if (text.includes('crash') || text.includes('accident')) score += 2;
  if (text.includes('closure') || text.includes('closed')) score += 2;
  if (text.includes('major') || text.includes('significant')) score += 1;
  if (text.includes('highway') || text.includes('interstate')) score += 1;
  
  return Math.min(score, 8);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('WISCONSIN_511_API_KEY');
    if (!apiKey) {
      throw new Error('WISCONSIN_511_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-511-traffic] Fetching Wisconsin 511 traffic events...');

    // Fetch events from Wisconsin 511 API
    const eventsResponse = await fetch(
      `${WI_511_API_BASE}/get/event?key=${apiKey}&format=json`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[sync-511-traffic] API Error:', eventsResponse.status, errorText);
      throw new Error(`Wisconsin 511 API error: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    console.log(`[sync-511-traffic] Received ${eventsData?.length || 0} total events`);

    // Filter to Walworth County area
    const localEvents: TrafficEvent[] = [];
    
    if (Array.isArray(eventsData)) {
      for (const event of eventsData) {
        const eventText = `${event.Headline || ''} ${event.Description || ''} ${event.RoadwayName || ''} ${event.County || ''}`;
        const lat = event.Latitude || event.StartLatitude;
        const lon = event.Longitude || event.StartLongitude;
        
        if (isInWalworthArea(lat, lon, eventText)) {
          localEvents.push({
            id: String(event.ID || event.EventId || event.id),
            type: event.EventType || event.Type || 'incident',
            title: event.Headline || event.Description?.substring(0, 100) || 'Traffic Alert',
            description: event.Description || '',
            location: [event.RoadwayName, event.County, event.Direction].filter(Boolean).join(', ') || 'Walworth County',
            lat,
            lon,
            startTime: event.StartTime || event.StartDate,
            endTime: event.EndTime || event.EndDate,
            severity: event.Severity,
          });
        }
      }
    }

    console.log(`[sync-511-traffic] Found ${localEvents.length} local traffic events`);

    // Get the 511 source ID
    const { data: sourceData } = await supabase
      .from('sources')
      .select('id')
      .eq('name', 'Wisconsin 511 Traffic')
      .single();

    const sourceId = sourceData?.id;

    // Get existing 511 incident IDs to avoid duplicates
    const { data: existingIncidents } = await supabase
      .from('incidents')
      .select('id, title')
      .eq('incident_type', 'traffic')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const existingTitles = new Set(existingIncidents?.map(i => i.title.toLowerCase()) || []);

    let created = 0;
    let skipped = 0;

    for (const event of localEvents) {
      // Skip if we already have this incident (by title match)
      if (existingTitles.has(event.title.toLowerCase())) {
        skipped++;
        continue;
      }

      const incidentType = classifyIncidentType(event);
      const priorityScore = determineSeverity(event);
      const slug = `${incidentType}-${event.id}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Create incident
      const { data: incident, error: incidentError } = await supabase
        .from('incidents')
        .insert({
          title: event.title,
          incident_type: incidentType,
          location: event.location,
          status: 'active',
          priority_score: priorityScore,
          slug,
          started_at: event.startTime ? new Date(event.startTime).toISOString() : new Date().toISOString(),
        })
        .select('id')
        .single();

      if (incidentError) {
        console.error(`[sync-511-traffic] Error creating incident:`, incidentError);
        continue;
      }

      // Add initial update
      if (incident) {
        await supabase.from('incident_updates').insert({
          incident_id: incident.id,
          text: event.description || event.title,
          source: 'wi511',
          source_label: 'Wisconsin 511',
          is_verified: true,
        });

        created++;
        existingTitles.add(event.title.toLowerCase());
        console.log(`[sync-511-traffic] Created incident: ${event.title}`);
      }
    }

    // Update source last_fetched_at
    if (sourceId) {
      await supabase
        .from('sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', sourceId);
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'source',
      entity_id: sourceId,
      action: 'sync_completed',
      actor_type: 'system',
      message: `Wisconsin 511: ${created} incidents created, ${skipped} skipped`,
      details: { created, skipped, total_local: localEvents.length },
    });

    console.log(`[sync-511-traffic] Sync complete: ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        total_local_events: localEvents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-511-traffic] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
