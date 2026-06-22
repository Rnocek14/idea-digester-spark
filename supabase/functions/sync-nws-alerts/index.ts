import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NWS Zones: Walworth (WIZ063) + adjacent Rock (WIZ062) + Jefferson (WIZ057).
// NWS supports comma-separated zone queries; we keep the geo_label as Lake Geneva
// since these adjacent zones routinely share the same regional grid alert.
const NWS_ZONES = ['WIZ063', 'WIZ062', 'WIZ057'];
const NWS_ZONE = NWS_ZONES.join(','); // kept for metadata/back-compat
const NWS_ALERTS_URL = `https://api.weather.gov/alerts/active?zone=${NWS_ZONE}`;

// Weather-type-specific fallback images for alerts - multiple images per type for variety
const WEATHER_IMAGES: Record<string, string[]> = {
  // Winter weather
  snow: [
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
    'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
  ],
  winter: [
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=800&q=80',
  ],
  blizzard: [
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
  ],
  ice: [
    'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?w=800&q=80',
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
  ],
  freeze: [
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?w=800&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
  ],
  frost: [
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?w=800&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
  ],
  cold: [
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
  ],
  
  // Severe weather
  tornado: [
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
  ],
  thunderstorm: [
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
  ],
  severe: [
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80',
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
  ],
  storm: [
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80',
  ],
  
  // Wind
  wind: [
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80',
  ],
  gust: [
    'https://images.unsplash.com/photo-1527482937786-6f0ba41471a8?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
  ],
  
  // Rain/Flood
  rain: [
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80',
    'https://images.unsplash.com/photo-1445966275305-9806327ea2b5?w=800&q=80',
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80',
  ],
  flood: [
    'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80',
  ],
  flash: [
    'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80',
  ],
  
  // Heat
  heat: [
    'https://images.unsplash.com/photo-1504370805625-d32c54b16100?w=800&q=80',
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80',
  ],
  excessive: [
    'https://images.unsplash.com/photo-1504370805625-d32c54b16100?w=800&q=80',
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80',
  ],
  
  // Fog/Visibility
  fog: [
    'https://images.unsplash.com/photo-1543968996-ee822b8176ba?w=800&q=80',
    'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80',
  ],
  dense: [
    'https://images.unsplash.com/photo-1543968996-ee822b8176ba?w=800&q=80',
    'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80',
  ],
  
  // Default weather
  default: [
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80',
    'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80',
    'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
    'https://images.unsplash.com/photo-1445966275305-9806327ea2b5?w=800&q=80',
  ],
};

// djb2 hash function for consistent fingerprint-based selection
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Get appropriate weather image based on event type and alert ID (for variety)
function getWeatherImage(event: string, alertId: string): string {
  const eventLower = event.toLowerCase();
  
  // Check for specific weather keywords in order of priority
  const keywords = [
    'tornado', 'blizzard', 'thunderstorm', 'flood', 'flash',
    'snow', 'winter', 'ice', 'freeze', 'frost', 'cold',
    'wind', 'gust', 'storm', 'severe',
    'rain', 'heat', 'excessive', 'fog', 'dense'
  ];
  
  let images = WEATHER_IMAGES.default;
  
  for (const keyword of keywords) {
    if (eventLower.includes(keyword)) {
      images = WEATHER_IMAGES[keyword] || WEATHER_IMAGES.default;
      break;
    }
  }
  
  // Use alertId to pick a consistent but varied image from the array
  const hash = hashString(alertId);
  return images[hash % images.length];
}

// Extract the core event type from NWS event name for superseding logic
function extractEventType(event: string): string {
  const eventLower = (event || '').toLowerCase();
  
  // Map to core event types for grouping
  if (eventLower.includes('wind advisory') || eventLower.includes('wind warning')) return 'wind';
  if (eventLower.includes('winter weather') || eventLower.includes('winter storm')) return 'winter';
  if (eventLower.includes('dense fog')) return 'fog';
  if (eventLower.includes('tornado')) return 'tornado';
  if (eventLower.includes('flood')) return 'flood';
  if (eventLower.includes('thunderstorm')) return 'thunderstorm';
  if (eventLower.includes('heat')) return 'heat';
  if (eventLower.includes('freeze') || eventLower.includes('frost')) return 'freeze';
  if (eventLower.includes('blizzard')) return 'blizzard';
  if (eventLower.includes('ice storm')) return 'ice';
  if (eventLower.includes('snow')) return 'snow';
  
  // Fallback: use the full event as-is
  return eventLower;
}

// Generate URL-friendly slug from title
function slugifyIncidentTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Supersede older weather alerts of the same event type
async function supersedeOlderAlerts(opts: {
  supabase: any;
  eventType: string;
  sourceId: string;
  newAlertId: string;
}): Promise<number> {
  const { supabase, eventType, sourceId, newAlertId } = opts;
  
  // Build pattern for matching this event type
  const patterns: Record<string, string> = {
    wind: '%Wind%',
    winter: '%Winter%',
    fog: '%Fog%',
    tornado: '%Tornado%',
    flood: '%Flood%',
    thunderstorm: '%Thunderstorm%',
    heat: '%Heat%',
    freeze: '%Freeze%',
    frost: '%Frost%',
    blizzard: '%Blizzard%',
    ice: '%Ice Storm%',
    snow: '%Snow%',
  };
  
  const pattern = patterns[eventType] || `%${eventType}%`;
  
  // Find older published alerts of same event type
  const { data: oldAlerts, error: findError } = await supabase
    .from('content_queue')
    .select('id, title')
    .eq('category', 'weather')
    .eq('source_id', sourceId)
    .in('status', ['auto_published', 'published'])
    .ilike('title', pattern);
  
  if (findError) {
    console.error('[supersede] Error finding old alerts:', findError);
    return 0;
  }
  
  if (!oldAlerts?.length) {
    return 0;
  }
  
  console.log(`[supersede] Found ${oldAlerts.length} older ${eventType} alerts to supersede`);
  
  // Mark old alerts as rejected with superseded reason
  const { error: updateError } = await supabase
    .from('content_queue')
    .update({ 
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      metadata: {
        superseded_by: newAlertId,
        superseded_at: new Date().toISOString(),
        supersede_reason: 'New NWS alert of same type issued'
      }
    })
    .in('id', oldAlerts.map((a: any) => a.id));
  
  if (updateError) {
    console.error('[supersede] Error superseding alerts:', updateError);
    return 0;
  }
  
  // Also resolve old weather incidents of this type
  const { data: resolvedIncidents, error: incidentError } = await supabase
    .from('incidents')
    .update({ 
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_reason: 'Superseded by new NWS alert'
    })
    .eq('incident_type', 'weather')
    .in('status', ['active', 'monitoring'])
    .ilike('title', pattern)
    .select('id, title');
  
  if (incidentError) {
    console.error('[supersede] Error resolving old incidents:', incidentError);
  } else if (resolvedIncidents?.length) {
    console.log(`[supersede] Resolved ${resolvedIncidents.length} old weather incidents`);
  }
  
  return oldAlerts.length;
}

// Link weather alert to an incident (find or create)
async function linkAlertToIncident(opts: {
  supabase: any;
  storyId: string;
  title: string;
  summary: string | null;
  priorityScore: number;
  event: string;
  status?: string;
}) {
  const { supabase, storyId, title, summary, priorityScore, event, status = 'active' } = opts;

  // Try to find an existing active weather incident with similar event type
  const { data: existingIncidents, error: findError } = await supabase
    .from('incidents')
    .select('*')
    .eq('incident_type', 'weather')
    .in('status', ['active', 'monitoring'])
    .ilike('title', `%${event}%`)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (findError) {
    console.error('[incidents] Error finding existing incident', findError);
    return;
  }

  let incident = existingIncidents?.[0];

  if (!incident) {
    // Create new incident
    const baseSlug = slugifyIncidentTitle(title);
    const slug = baseSlug || `weather-${storyId}`;

    const { data: inserted, error: insertError } = await supabase
      .from('incidents')
      .insert({
        slug,
        title,
        incident_type: 'weather',
        status, // Use passed status (active for severe, monitoring for minor)
        location: 'Walworth County / Lake Geneva area',
        source_story_id: storyId,
        priority_score: priorityScore,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[incidents] Error creating new weather incident', insertError);
      return;
    }
    incident = inserted;
    console.log(`[incidents] Created new weather incident: ${title}`);
  } else {
    // Update existing incident
    const newPriority = Math.max(incident.priority_score || 0, priorityScore);
    await supabase
      .from('incidents')
      .update({
        priority_score: newPriority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incident.id);
    console.log(`[incidents] Linked to existing weather incident: ${incident.title}`);
  }

  // Add timeline update
  const { error: updateError } = await supabase
    .from('incident_updates')
    .insert({
      incident_id: incident.id,
      source: 'nws',
      source_label: 'National Weather Service',
      text: summary || title,
      is_verified: true,
      story_id: storyId,
    });

  if (updateError) {
    console.error('[incidents] Error inserting incident update', updateError);
  }

  return incident;
}

interface NWSAlert {
  id: string;
  properties: {
    id: string;
    areaDesc: string;
    sent: string;
    effective: string;
    onset: string;
    expires: string;
    ends: string;
    status: string;
    messageType: string;
    severity: string;
    certainty: string;
    urgency: string;
    event: string;
    headline: string;
    description: string;
    instruction: string;
    response: string;
    senderName: string;
  };
}

interface SyncResult {
  source: string;
  new_items: number;
  skipped_duplicates: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const result: SyncResult = {
    source: 'NWS Weather Alerts',
    new_items: 0,
    skipped_duplicates: 0,
    errors: [],
  };

  try {
    console.log('[sync-nws] Fetching NWS alerts for zone:', NWS_ZONE);

    // Fetch alerts from NWS API
    const response = await fetch(NWS_ALERTS_URL, {
      headers: {
        'User-Agent': '(Lake Geneva Brief, newsletter@citybrief.info)',
        'Accept': 'application/geo+json',
      },
    });

    if (!response.ok) {
      throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const alerts: NWSAlert[] = data.features || [];

    console.log(`[sync-nws] Found ${alerts.length} active alerts`);

    if (alerts.length === 0) {
      console.log('[sync-nws] No active alerts - this is normal');
      
      // Log the sync attempt
      await supabase.from('activity_log').insert({
        entity_type: 'source',
        action: 'sync_completed',
        actor_type: 'system',
        message: 'NWS Weather Alerts synced: No active alerts',
        details: { source: 'NWS Weather Alerts', alerts_found: 0 }
      });

      return new Response(
        JSON.stringify({ success: true, result, message: 'No active weather alerts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create NWS source
    let { data: nwsSource } = await supabase
      .from('sources')
      .select('id')
      .eq('name', 'NWS Weather Alerts – Lake Geneva')
      .single();

    if (!nwsSource) {
      // Create the source if it doesn't exist
      const { data: newSource, error: sourceError } = await supabase
        .from('sources')
        .insert({
          name: 'NWS Weather Alerts – Lake Geneva',
          type: 'api',
          url: NWS_ALERTS_URL,
          category: 'weather',
          status: 'active',
          metadata: {
            zone: NWS_ZONE,
            location_tags: ['Lake Geneva', 'Walworth County'],
            description: 'National Weather Service alerts for Lake Geneva area'
          }
        })
        .select('id')
        .single();

      if (sourceError) {
        console.error('[sync-nws] Error creating source:', sourceError);
        throw sourceError;
      }
      nwsSource = newSource;
      console.log('[sync-nws] Created NWS source:', nwsSource?.id);
    }

    // Process each alert
    for (const alert of alerts) {
      const props = alert.properties;
      const alertId = props.id || alert.id;
      
      // Check for duplicates using the NWS alert ID in metadata or original_url
      const { data: existing } = await supabase
        .from('content_queue')
        .select('id')
        .eq('original_url', alertId)
        .single();

      if (existing) {
        result.skipped_duplicates++;
        console.log(`[sync-nws] Skipping duplicate alert: ${props.event}`);
        continue;
      }

      // SUPERSEDE older alerts of the same event type before inserting
      const eventType = extractEventType(props.event);
      console.log(`[sync-nws] Event type extracted: "${eventType}" from "${props.event}"`);
      
      // Supersede older alerts of same type (e.g., old Wind Advisory when new one comes in)
      if (nwsSource?.id) {
        const supersededCount = await supersedeOlderAlerts({
          supabase,
          eventType,
          sourceId: nwsSource.id,
          newAlertId: alertId,
        });
        if (supersededCount > 0) {
          console.log(`[sync-nws] Superseded ${supersededCount} older ${eventType} alerts`);
        }
      }

      // Determine severity-based safety level and breaking news priority
      let safetyLevel = 'safe';
      let isBreaking = false;
      let priorityScore = 3; // Base score for all weather alerts
      
      if (props.severity === 'Extreme') {
        safetyLevel = 'sensitive';
        isBreaking = true;
        priorityScore = 5;
        console.log(`[sync-nws] 🔴 BREAKING: Extreme severity alert - ${props.event}`);
      } else if (props.severity === 'Severe') {
        isBreaking = true;
        priorityScore = 4;
        console.log(`[sync-nws] 🔴 BREAKING: Severe alert - ${props.event}`);
      }
      
      // Extra priority for tornado/blizzard keywords
      const eventLower = (props.event || '').toLowerCase();
      if (eventLower.includes('tornado') || eventLower.includes('blizzard')) {
        isBreaking = true;
        priorityScore = Math.max(priorityScore, 5);
      }

      // Build content
      const title = props.headline || `${props.event} - ${props.areaDesc}`;
      const summary = props.description?.slice(0, 500) || props.headline;
      const content = [
        props.description,
        props.instruction ? `\n\n**What to do:** ${props.instruction}` : '',
      ].filter(Boolean).join('');

      const publishDate = props.effective || props.sent || new Date().toISOString();
      
      // Get weather-type-specific image using alertId for fingerprint-based variety
      const imageUrl = getWeatherImage(props.event || '', alertId);
      console.log(`[sync-nws] Using image for "${props.event}" (${alertId.slice(-8)}): ${imageUrl.substring(0, 50)}...`);

      // Insert into content_queue
      const { data: insertedAlert, error: insertError } = await supabase
        .from('content_queue')
        .insert({
          source_id: nwsSource?.id,
          title,
          summary,
          content,
          category: 'weather',
          original_url: alertId,
          publish_date: publishDate,
          status: 'auto_published',
          safety_level: safetyLevel,
          safety_tags: ['weather'],
          safety_reason: safetyLevel === 'sensitive' ? `High severity: ${props.severity}` : null,
          is_breaking: isBreaking,
          priority_score: priorityScore,
          geo_tier: 1, // NWS alerts for our zone are always local (tier 1)
          geo_label: 'Lake Geneva',
          image_url: imageUrl, // Weather-type-specific image
          image_source: 'fallback_weather',
          metadata: {
            source_name: 'NWS Weather Alerts',
            nws_id: alertId,
            severity: props.severity,
            certainty: props.certainty,
            urgency: props.urgency,
            event: props.event,
            effective: props.effective,
            expires: props.expires,
            onset: props.onset,
            ends: props.ends,
            area_description: props.areaDesc,
            sender: props.senderName,
            response_type: props.response,
            raw_alert: props,
            location_tags: ['Lake Geneva', 'Walworth County'],
            verticals: ['local', 'civic'],
            content_tags: ['weather', 'alerts', props.event?.toLowerCase()].filter(Boolean),
          }
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`[sync-nws] Error inserting alert:`, insertError);
        result.errors.push(`Failed to insert: ${props.event}`);
        continue;
      }

      result.new_items++;
      console.log(`[sync-nws] Inserted alert: ${props.event} (${props.severity})`);

      // Link ALL weather alerts to incidents (not just breaking)
      // Severity determines priority_score and status, not whether incident is created
      if (insertedAlert) {
        // Determine incident status based on severity
        const incidentStatus = (props.severity === 'Extreme' || props.severity === 'Severe') 
          ? 'active' 
          : 'monitoring';
        
        await linkAlertToIncident({
          supabase,
          storyId: insertedAlert.id,
          title,
          summary,
          priorityScore,
          event: props.event,
          status: incidentStatus,
        });
      }
    }

    // Update source last_fetched_at
    await supabase
      .from('sources')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', nwsSource?.id);

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'source',
      action: 'sync_completed',
      actor_type: 'system',
      message: `NWS Weather Alerts synced: ${result.new_items} new, ${result.skipped_duplicates} skipped`,
      details: {
        source: 'NWS Weather Alerts',
        new_items: result.new_items,
        skipped: result.skipped_duplicates,
        total_alerts: alerts.length,
      }
    });

    console.log('[sync-nws] Sync complete:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-nws] Fatal error:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));

    return new Response(
      JSON.stringify({ success: false, result, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
