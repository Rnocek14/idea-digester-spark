import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State 511 API base, bbox, and gazetteer come from city_config.
// Official WI API docs: https://511wi.gov/developers/doc
// FLEET PATTERN: this function loops over every active city (phase 2b) —
// per-city bbox/keywords/city_id, one shared invocation. Cities without a
// state_511_api_base are skipped.
import { getActiveCityConfigs, withinBbox, hasLocalKeyword, type CityConfig } from '../_shared/cityConfig.ts';

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

function isInLocalArea(config: CityConfig, lat?: number, lon?: number, text?: string): boolean {
  if (withinBbox(config.bbox, lat ?? null, lon ?? null)) return true;
  if (text) return hasLocalKeyword(config, text);
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

type CitySyncResult = {
  city_id: string;
  created: number;
  skipped: number;
  total_local_events: number;
  upstream_healthy: boolean;
};

async function syncCityTraffic(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  config: CityConfig,
): Promise<CitySyncResult> {
  const API_BASE = config.state_511_api_base!;
  const BOUNDS = config.bbox;

  console.log(`[sync-511-traffic] (${config.id}) Fetching 511 traffic events...`);

  // Try multiple API endpoints - the 511 API has different endpoints for different data
  let eventsData = [];
  let upstreamHealthy = false;
  let lastErrorCode: string | null = null;
  let lastErrorDetail: string | null = null;

  // Try getevents endpoint (official documented endpoint)
  try {
    const eventsUrl = `${API_BASE}/getevents?key=${apiKey}&format=json`;
    console.log(`[sync-511-traffic] Fetching: ${eventsUrl.replace(apiKey, 'API_KEY')}`);

    const eventsResponse = await fetch(eventsUrl, {
      headers: { 'Accept': 'application/json' }
    });

    console.log(`[sync-511-traffic] getevents response status: ${eventsResponse.status}`);

    if (eventsResponse.ok) {
      eventsData = await eventsResponse.json();
      upstreamHealthy = true;
      console.log(`[sync-511-traffic] getevents returned ${eventsData?.length || 0} events`);
    } else {
      const errorText = await eventsResponse.text();
      lastErrorCode = `getevents_${eventsResponse.status}`;
      lastErrorDetail = errorText.substring(0, 300);
      console.error('[sync-511-traffic] getevents Error:', eventsResponse.status, errorText.substring(0, 300));
    }
  } catch (fetchError: any) {
    lastErrorCode = 'getevents_fetch_error';
    lastErrorDetail = fetchError.message;
    console.error('[sync-511-traffic] getevents fetch error:', fetchError.message);
  }

  // Fallback 1: try geteventsbybbox over the city bounding box
  if (!eventsData || eventsData.length === 0) {
    try {
      const bboxUrl = `${API_BASE}/geteventsbybbox?key=${apiKey}&format=json` +
        `&xmin=${BOUNDS.minLon}&ymin=${BOUNDS.minLat}` +
        `&xmax=${BOUNDS.maxLon}&ymax=${BOUNDS.maxLat}`;
      console.log(`[sync-511-traffic] Fetching bbox fallback: ${bboxUrl.replace(apiKey, 'API_KEY')}`);
      const bboxResp = await fetch(bboxUrl, { headers: { 'Accept': 'application/json' } });
      console.log(`[sync-511-traffic] geteventsbybbox status: ${bboxResp.status}`);
      if (bboxResp.ok) {
        const bboxData = await bboxResp.json();
        if (Array.isArray(bboxData) && bboxData.length > 0) {
          eventsData = bboxData;
          upstreamHealthy = true;
          console.log(`[sync-511-traffic] geteventsbybbox returned ${bboxData.length} events`);
        } else {
          upstreamHealthy = true; // 200 with empty array = healthy quiet
        }
      } else {
        const t = await bboxResp.text();
        lastErrorCode = lastErrorCode ?? `geteventsbybbox_${bboxResp.status}`;
        lastErrorDetail = lastErrorDetail ?? t.substring(0, 300);
      }
    } catch (e: any) {
      console.error('[sync-511-traffic] bbox fetch error:', e.message);
    }
  }

  // Fallback 2: getalerts endpoint
  if (!eventsData || eventsData.length === 0) {
    try {
      const alertsUrl = `${API_BASE}/getalerts?key=${apiKey}&format=json`;
      console.log(`[sync-511-traffic] Fetching: ${alertsUrl.replace(apiKey, 'API_KEY')}`);

      const alertsResponse = await fetch(alertsUrl, {
        headers: { 'Accept': 'application/json' }
      });

      console.log(`[sync-511-traffic] getalerts response status: ${alertsResponse.status}`);

      if (alertsResponse.ok) {
        eventsData = await alertsResponse.json();
        upstreamHealthy = true;
        console.log(`[sync-511-traffic] getalerts returned ${eventsData?.length || 0} alerts`);
      } else {
        const errorText = await alertsResponse.text();
        lastErrorCode = lastErrorCode ?? `getalerts_${alertsResponse.status}`;
        lastErrorDetail = lastErrorDetail ?? errorText.substring(0, 300);
        console.error('[sync-511-traffic] getalerts Error:', alertsResponse.status, errorText.substring(0, 300));
      }
    } catch (fetchError: any) {
      console.error('[sync-511-traffic] getalerts fetch error:', fetchError.message);
    }
  }

  console.log(`[sync-511-traffic] (${config.id}) Total events/incidents received: ${eventsData?.length || 0}`);

  // Filter to the configured local area
  const localEvents: TrafficEvent[] = [];

  if (Array.isArray(eventsData)) {
    for (const event of eventsData) {
      const eventText = `${event.Headline || ''} ${event.Description || ''} ${event.RoadwayName || ''} ${event.County || ''}`;
      const lat = event.Latitude || event.StartLatitude;
      const lon = event.Longitude || event.StartLongitude;

      if (isInLocalArea(config, lat, lon, eventText)) {
        localEvents.push({
          id: String(event.ID || event.EventId || event.id),
          type: event.EventType || event.Type || 'incident',
          title: event.Headline || event.Description?.substring(0, 100) || 'Traffic Alert',
          description: event.Description || '',
          location: [event.RoadwayName, event.County, event.Direction].filter(Boolean).join(', ') || config.county_name,
          lat,
          lon,
          startTime: event.StartTime || event.StartDate,
          endTime: event.EndTime || event.EndDate,
          severity: event.Severity,
        });
      }
    }
  }

  console.log(`[sync-511-traffic] (${config.id}) Found ${localEvents.length} local traffic events`);

  // Get this city's 511 source row (heartbeat target)
  const { data: sourceData } = await supabase
    .from('sources')
    .select('id')
    .eq('name', 'Wisconsin 511 Traffic')
    .eq('city_id', config.id)
    .maybeSingle();

  const sourceId = sourceData?.id;

  // Get existing 511 incident titles for this city to avoid duplicates
  const { data: existingIncidents } = await supabase
    .from('incidents')
    .select('id, title')
    .eq('incident_type', 'traffic')
    .eq('city_id', config.id)
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
    // Stable slug: event.id is the upstream identifier and is already unique. Date.now()
    // used to be appended, which minted a brand-new URL every time an incident was
    // recreated — so an archive accumulated churning URLs that no one can cite and that
    // Google reads as instability. Nothing that goes in a permanent URL may be derived
    // from wall-clock time.
    const slug = `${incidentType}-${event.id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Create incident
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .insert({
        title: event.title,
        city_id: config.id,
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

  // Update source heartbeat + health flags so dashboard reflects upstream state
  if (sourceId) {
    const nowIso = new Date().toISOString();
    const update: Record<string, any> = {
      last_fetched_at: nowIso,
      last_items_ingested_count: created,
    };
    if (upstreamHealthy) {
      update.last_successful_fetch_at = nowIso;
      update.health_severity = 'ok';
      update.last_error_code = null;
      update.last_error_detail = null;
      if (created > 0) update.last_nonzero_run_at = nowIso;
      else update.last_zero_items_at = nowIso;
    } else {
      update.health_severity = 'warning';
      update.last_error_code = lastErrorCode;
      update.last_error_detail = lastErrorDetail;
    }
    await supabase.from('sources').update(update).eq('id', sourceId);
  }

  // Log activity
  await supabase.from('activity_log').insert({
    entity_type: 'source',
    entity_id: sourceId,
    action: 'sync_completed',
    actor_type: 'system',
    message: `Wisconsin 511 (${config.id}): ${created} incidents created, ${skipped} skipped`,
    details: { city_id: config.id, created, skipped, total_local: localEvents.length },
  });

  console.log(`[sync-511-traffic] (${config.id}) Sync complete: ${created} created, ${skipped} skipped`);

  return {
    city_id: config.id,
    created,
    skipped,
    total_local_events: localEvents.length,
    upstream_healthy: upstreamHealthy,
  };
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

    const cities = await getActiveCityConfigs(supabase);
    const results: CitySyncResult[] = [];
    let skippedCities = 0;

    for (const config of cities) {
      if (!config.state_511_api_base) {
        console.log(`[sync-511-traffic] (${config.id}) no state_511_api_base configured — skipping`);
        skippedCities++;
        continue;
      }
      try {
        results.push(await syncCityTraffic(supabase, apiKey, config));
      } catch (cityError) {
        // One city's failure must never block the rest of the fleet.
        console.error(`[sync-511-traffic] (${config.id}) city sync failed:`, cityError);
        results.push({ city_id: config.id, created: 0, skipped: 0, total_local_events: 0, upstream_healthy: false });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cities: results,
        cities_skipped: skippedCities,
        created: results.reduce((n, r) => n + r.created, 0),
        skipped: results.reduce((n, r) => n + r.skipped, 0),
        total_local_events: results.reduce((n, r) => n + r.total_local_events, 0),
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
