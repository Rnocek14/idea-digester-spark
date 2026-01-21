import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Story {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string | null;
  content_newsletter: string | null;
  voice_generated_at: string | null;
  status: string;
  created_at: string;
  original_url: string | null;
  event_date?: string | null;
  event_time?: string | null;
  performer?: string | null;
  metadata?: any;
}

interface Subscriber {
  id: string;
  email: string;
  unsubscribe_token: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  incident_type: string;
  updated_at: string;
}

interface LaterEvent {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  performer: string | null;
  original_url: string | null;
  metadata?: any;
}

// ============= VENUE EXTRACTION (ported from NightlifeWidget) =============

const KNOWN_VENUES = [
  'Geneva Tap House', 'PIER 290', 'Mars Resort', 'The Lookout Bar', 'The Lookout',
  'Evolve', 'Baker House', 'Hogs & Kisses', 'Topsy Turvy', 'The Cat',
  'Maxwell Mansion', 'Abbey Resort', 'Lake Lawn Resort', 'Grand Geneva',
  'Pier 290', 'Lookout Bar', 'The Getaway', 'Harpoon Willies', "Harpoon Willie's"
];

const VENUE_ALIASES: Record<string, string> = {
  'the lookout': 'The Lookout Bar',
  'lookout bar': 'The Lookout Bar',
  'the lookout bar': 'The Lookout Bar',
  'pier 290': 'PIER 290',
  'the cat': 'The Cat',
  'topsy turvy': 'Topsy Turvy',
  'at topsy turvy': 'Topsy Turvy',
  'the getaway': 'The Getaway',
  "harpoon willie's": "Harpoon Willie's",
  'harpoon willies': "Harpoon Willie's",
};

function normalizeVenueName(venue: string): string {
  const lower = venue.toLowerCase().trim();
  return VENUE_ALIASES[lower] || venue;
}

function extractVenue(title: string): string {
  const atVenueMatch = title.match(/(?:@|at\s+(?:the\s+)?)([\w\s']+?)(?:\s*[:\-–]|$)/i);
  if (atVenueMatch) {
    const venue = atVenueMatch[1].trim();
    const normalized = normalizeVenueName(venue);
    if (normalized !== venue) return normalized;
    for (const known of KNOWN_VENUES) {
      if (known.toLowerCase().includes(venue.toLowerCase()) || 
          venue.toLowerCase().includes(known.toLowerCase().replace('the ', ''))) {
        return known;
      }
    }
    return venue;
  }
  for (const venue of KNOWN_VENUES) {
    if (title.toLowerCase().includes(venue.toLowerCase())) {
      return normalizeVenueName(venue);
    }
  }
  return '';
}

function extractPerformerFromTitle(title: string): string | null {
  const colonMatch = title.match(/:\s*([^:]+?)\s*$/i);
  if (colonMatch) {
    let performer = colonMatch[1].trim();
    const liveAsMatch = performer.match(/^(.+?)\s+LIVE\s+(?:as|performing|plays)/i);
    if (liveAsMatch) performer = liveAsMatch[1].trim();
    if (performer.includes(' - ')) {
      const parts = performer.split(' - ');
      performer = parts[parts.length - 1].trim();
    }
    if (performer.length >= 3 && performer.length <= 50) {
      return performer;
    }
  }
  return null;
}

// Calculate pick score (ported from NightlifeWidget)
function calculatePickScore(event: LaterEvent): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const title = event.title.toLowerCase();
  
  const hasPerformer = event.performer || extractPerformerFromTitle(event.title);
  if (hasPerformer) {
    score += 3;
    reasons.push('confirmed performer');
  }
  
  if (event.event_time) {
    score += 2;
    reasons.push('start time');
  }
  
  if (event.original_url) {
    score += 2;
  }
  
  const hasSpecificVenue = KNOWN_VENUES.some(v => title.includes(v.toLowerCase()));
  if (hasSpecificVenue) {
    score += 2;
    reasons.push('known venue');
  }
  
  const lowValuePatterns = [
    'live music at', 'live music every', 'featuring live', 
    'music every', 'live entertainment', 'every friday', 'every saturday'
  ];
  if (lowValuePatterns.some(p => title.includes(p) && !hasPerformer)) score -= 5;
  
  if (!hasPerformer && title.length < 30) score -= 3;
  if (!event.event_date) score -= 3;
  
  let reason = 'Upcoming event';
  if (reasons.length > 0) {
    reason = reasons.length === 1 
      ? `Has ${reasons[0]}` 
      : `Has ${reasons.slice(0, -1).join(', ')} + ${reasons[reasons.length - 1]}`;
  }
  
  return { score, reason };
}

// Get Chicago timezone date info
function getChicagoDate(): { dateStr: string; dayOfWeek: number; dayName: string } {
  const now = new Date();
  // Format in Chicago timezone
  const chicagoStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const chicagoDate = new Date(chicagoStr);
  const dayOfWeek = chicagoDate.getDay();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Get YYYY-MM-DD in Chicago timezone
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  
  return {
    dateStr: `${year}-${month}-${day}`,
    dayOfWeek,
    dayName: days[dayOfWeek]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false, sendNow = false } = await req.json().catch(() => ({}));
    console.log(`🚀 Autopilot Newsletter Engine starting... (force=${force}, sendNow=${sendNow})`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // KILL SWITCH CHECK
    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = settings?.value?.enabled !== false;
    const newsletterEnabled = settings?.value?.newsletter_enabled !== false;
    
    // Feature flag for V2 newsletter (default to v2 since it's now implemented)
    const newsletterVersion = settings?.value?.newsletter_version || 'v2';
    const useV2 = newsletterVersion === 'v2';
    console.log(`📧 Newsletter version: ${newsletterVersion} (useV2=${useV2})`);
    
    if (!automationEnabled || !newsletterEnabled) {
      console.log("⛔ Newsletter automation is disabled via kill switch");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Newsletter automation is disabled",
          automation_enabled: automationEnabled,
          newsletter_enabled: newsletterEnabled
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    console.log("✅ Kill switch check passed");

    // Get today's date
    const today = new Date();
    const editionDate = today.toISOString().split("T")[0];

    console.log(`📅 Checking for existing newsletter for ${editionDate}...`);

    // Check if newsletter already exists for today
    const { data: existingNewsletter } = await supabase
      .from("newsletters")
      .select("id, status, subject, story_count")
      .eq("edition_date", editionDate)
      .maybeSingle();

    if (existingNewsletter && !force) {
      console.log(`✅ Newsletter already exists for today (status: ${existingNewsletter.status})`);
      
      // BUG FIX: If newsletter exists with status='ready' AND sendNow=true, send it!
      if (existingNewsletter.status === "ready" && sendNow) {
        console.log("📧 sendNow=true and newsletter is ready, sending existing newsletter...");
        
        // Fetch full newsletter for sending
        const { data: fullNewsletter, error: fetchFullError } = await supabase
          .from("newsletters")
          .select("*")
          .eq("id", existingNewsletter.id)
          .single();
        
        if (fetchFullError || !fullNewsletter) {
          throw new Error(`Failed to fetch newsletter for sending: ${fetchFullError?.message}`);
        }
        
        const { sent, failed, errors, subscriberCount } = await sendNewsletterEmail(supabase, fullNewsletter, supabaseUrl);
        
        console.log(`📧 Send result: sent=${sent}, failed=${failed}, subscriberCount=${subscriberCount}, errors=${JSON.stringify(errors)}`);
        
        if (sent > 0) {
          // Update status to sent
          const { error: updateSentError } = await supabase
            .from("newsletters")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", existingNewsletter.id);
          
          if (updateSentError) {
            console.error("Failed to update newsletter status:", updateSentError);
          } else {
            console.log(`✅ Newsletter status updated to 'sent' for ID: ${existingNewsletter.id}`);
          }
          
          console.log(`✅ Newsletter sent to ${sent} subscribers (${failed} failed)`);
          
          return new Response(
            JSON.stringify({
              success: true,
              newsletter_id: existingNewsletter.id,
              status: "sent",
              story_count: existingNewsletter.story_count,
              subject: existingNewsletter.subject,
              sent_count: sent,
              failed_count: failed,
              subscriber_count: subscriberCount,
              message: `Newsletter sent to ${sent} subscribers`,
              already_existed: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        } else {
          // ALL sends failed - return detailed error info
          console.log(`⚠️ No emails were sent. Errors: ${JSON.stringify(errors)}`);
          
          // Determine the actual error message
          let errorMessage = "No emails were sent";
          if (errors.length > 0) {
            // Check for common Resend errors
            if (errors.some(e => e.includes("domain is not verified"))) {
              errorMessage = "Email domain not verified in Resend. Please verify citybrief.info at https://resend.com/domains";
            } else if (errors.some(e => e.includes("RESEND_API_KEY"))) {
              errorMessage = "RESEND_API_KEY not configured";
            } else if (subscriberCount === 0) {
              errorMessage = "No active subscribers found";
            } else {
              errorMessage = `Send failed: ${errors[0]}`;
            }
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              newsletter_id: existingNewsletter.id,
              status: existingNewsletter.status,
              message: errorMessage,
              sent_count: 0,
              failed_count: failed,
              subscriber_count: subscriberCount,
              errors: errors,
              hint: "Check the errors array for details. Domain verification is the most common issue."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      
      // Otherwise, just return existing newsletter info
      return new Response(
        JSON.stringify({ 
          newsletter_id: existingNewsletter.id,
          status: existingNewsletter.status,
          subject: existingNewsletter.subject,
          edition_date: editionDate,
          already_exists: true,
          existing_story_count: existingNewsletter.story_count,
          hint: "Pass sendNow=true to send this ready newsletter"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // If force=true and newsletter exists, delete it first
    if (existingNewsletter && force) {
      console.log(`🔄 Force regenerate: deleting existing newsletter ${existingNewsletter.id}`);
      const { error: deleteError } = await supabase
        .from("newsletters")
        .delete()
        .eq("id", existingNewsletter.id);
      
      if (deleteError) {
        console.error("Failed to delete existing newsletter:", deleteError);
        throw deleteError;
      }
      console.log("✅ Existing newsletter deleted, proceeding with fresh generation");
    }

    // ========== FRESHNESS PIPELINE ==========
    // Include stories from the last 72 hours OR use created_at as fallback
    // Extended window ensures we always have content for newsletters
    
    const freshnessWindowHours = 72; // Extended from 24 to 72 hours
    const freshCutoff = new Date();
    freshCutoff.setHours(freshCutoff.getHours() - freshnessWindowHours);
    
    const todayDate = today.toISOString().split("T")[0]; // YYYY-MM-DD for event_date comparison

    console.log(`🔍 Fetching fresh stories (last ${freshnessWindowHours}h, approved/auto_published/published + safe)...`);
    console.log(`   Freshness cutoff: ${freshCutoff.toISOString()}`);
    console.log(`   Today's date for events: ${todayDate}`);

    // Fetch fresh stories - use publish_date if available, otherwise created_at
    // This fixes the issue where stories without publish_date were being excluded
    // NON-LOCAL keywords for hyperlocal filtering
    const NON_LOCAL_TITLE_KEYWORDS = ['milwaukee', 'madison', 'chicago', 'racine', 'kenosha', 'waukesha', 'green bay', 'janesville', 'beloit', 'rockford', 'appleton', 'oshkosh'];

    const { data: freshStories, error: fetchError } = await supabase
      .from("content_queue")
      .select("id, title, content, summary, category, content_newsletter, voice_generated_at, status, created_at, original_url, publish_date, event_date, geo_tier")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .in("geo_tier", [1, 2]) // HYPERLOCAL LOCKDOWN: Only Lake Geneva (1) and county (2)
      .is("last_newsletter_id", null) // GUARDRAIL: Dedupe - never reuse stories
      .or(`publish_date.gte.${freshCutoff.toISOString()},and(publish_date.is.null,created_at.gte.${freshCutoff.toISOString()})`)
      .lte("created_at", today.toISOString()) // No future-dated stories
      .order("created_at", { ascending: false })
      .limit(100); // Cap results to prevent overwhelming

    if (fetchError) throw fetchError;

    // Filter out past events AND non-local titles
    let candidates = (freshStories || []).filter(story => {
      // If it has an event_date, it must be today or in the future
      if (story.event_date && story.event_date < todayDate) {
        return false;
      }
      // HYPERLOCAL: Exclude stories with non-local city names in title
      const titleLower = (story.title || '').toLowerCase();
      if (NON_LOCAL_TITLE_KEYWORDS.some(kw => titleLower.includes(kw))) {
        console.log(`⚠️ Excluding non-local story: ${story.title.substring(0, 50)}...`);
        return false;
      }
      return true;
    });

    console.log(`✅ Found ${candidates.length} fresh hyperlocal candidates (${freshStories?.length || 0} before filters)`);

    // ========== V2: LIVE SECTION DATA ==========
    // Fetch active incidents for LIVE section (includes details for rendering)
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    let liveIncidents: Incident[] = [];
    let liveFetchFailed = false;
    
    try {
      const { data: activeIncidents, error: incidentError } = await supabase
        .from("incidents")
        .select("id, title, severity, incident_type, updated_at")
        .eq("status", "active")
        .gte("updated_at", sixHoursAgo.toISOString())
        .order("severity", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (incidentError) {
        console.error("⚠️ LIVE fetch failed:", incidentError);
        liveFetchFailed = true;
      } else {
        liveIncidents = activeIncidents || [];
      }
    } catch (err) {
      console.error("⚠️ LIVE fetch exception:", err);
      liveFetchFailed = true;
    }

    const incidentCount = liveIncidents.length;
    console.log(`📢 Active incidents for LIVE section: ${incidentCount}${liveFetchFailed ? ' (fetch failed)' : ''}`);

    // ========== V2: LATER SECTION DATA ==========
    // Fetch candidates for Pick of the Day and Tonight's Schedule
    const chicagoInfo = getChicagoDate();
    const todayChicago = chicagoInfo.dateStr;
    const isWeekendSendDay = chicagoInfo.dayOfWeek === 4 || chicagoInfo.dayOfWeek === 5; // Thu or Fri
    
    console.log(`📅 Chicago date: ${todayChicago}, day: ${chicagoInfo.dayName}, weekend preview: ${isWeekendSendDay}`);
    
    // Calculate dates for next 3 days
    const in72Hours = new Date();
    in72Hours.setDate(in72Hours.getDate() + 3);
    const in72HoursStr = in72Hours.toISOString().split('T')[0];
    
    // Fetch pick candidates (nightlife events in next 72h)
    let laterPick: LaterEvent | null = null;
    let laterPickReason = '';
    
    const { data: pickCandidates } = await supabase
      .from("content_queue")
      .select("id, title, event_date, event_time, performer, original_url, metadata")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .eq("category", "events")
      .contains("metadata", { verticals: ["nightlife"] })
      .gte("event_date", todayChicago)
      .lte("event_date", in72HoursStr)
      .order("event_date", { ascending: true })
      .limit(15);
    
    if (pickCandidates && pickCandidates.length > 0) {
      // Score candidates using the same algorithm as homepage
      const scored = (pickCandidates as LaterEvent[]).map(e => {
        const result = calculatePickScore(e);
        return { event: e, score: result.score, reason: result.reason };
      });
      
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aDate = a.event.event_date || '';
        const bDate = b.event.event_date || '';
        return aDate.localeCompare(bDate);
      });
      
      if (scored[0] && scored[0].score > 0) {
        laterPick = scored[0].event;
        laterPickReason = scored[0].reason;
        console.log(`⭐ Pick of the Day: ${laterPick.title} (score: ${scored[0].score})`);
      }
    }
    
    // Fetch tonight's schedule (events for today) - FIX: Filter to nightlife vertical
    const { data: tonightEvents } = await supabase
      .from("content_queue")
      .select("id, title, event_date, event_time, original_url, metadata")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .eq("category", "events")
      .contains("metadata", { verticals: ["nightlife"] }) // FIX: Filter to nightlife vertical
      .eq("event_date", todayChicago)
      .order("event_time", { ascending: true, nullsFirst: false })
      .limit(4);
    
    const tonightSchedule = (tonightEvents || []) as LaterEvent[];
    console.log(`🌙 Tonight's schedule: ${tonightSchedule.length} nightlife events`);
    
    // Weekend preview (only on Thu/Fri) - FIX: Use Chicago timezone for date math
    let weekendEvents: LaterEvent[] = [];
    if (isWeekendSendDay) {
      // Compute Saturday/Sunday in Chicago timezone
      const chicagoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const chicagoDayOfWeek = chicagoNow.getDay();
      const daysUntilSat = (6 - chicagoDayOfWeek + 7) % 7 || 7;
      
      const saturdayChicago = new Date(chicagoNow);
      saturdayChicago.setDate(chicagoNow.getDate() + daysUntilSat);
      const saturdayStr = `${saturdayChicago.getFullYear()}-${String(saturdayChicago.getMonth() + 1).padStart(2, '0')}-${String(saturdayChicago.getDate()).padStart(2, '0')}`;
      
      const sundayChicago = new Date(saturdayChicago);
      sundayChicago.setDate(saturdayChicago.getDate() + 1);
      const sundayStr = `${sundayChicago.getFullYear()}-${String(sundayChicago.getMonth() + 1).padStart(2, '0')}-${String(sundayChicago.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Weekend dates (Chicago): Sat=${saturdayStr}, Sun=${sundayStr}`);
      
      const { data: weekendData } = await supabase
        .from("content_queue")
        .select("id, title, event_date, event_time, original_url, metadata")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] }) // FIX: Filter to nightlife vertical
        .in("event_date", [saturdayStr, sundayStr])
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(6);
      
      weekendEvents = (weekendData || []) as LaterEvent[];
      console.log(`📅 Weekend preview: ${weekendEvents.length} nightlife events`);
    }

    // ========== V2: UPDATED MINIMUM CONTENT THRESHOLD ==========
    // Send if: LATEST ≥ 2 OR LIVE exists OR LATER has ≥ 2 items
    // This gives resilience on slow news days but busy nightlife days
    const latestStoryCount = candidates.filter(s => s.category !== "events").length;
    const laterItemCount = tonightSchedule.length + (laterPick ? 1 : 0);
    
    const hasEnoughContent = 
      latestStoryCount >= 2 || 
      incidentCount >= 1 ||
      laterItemCount >= 2;

    if (!hasEnoughContent) {
      const totalContent = latestStoryCount + laterItemCount;
      const skipReason = totalContent === 0 
        ? "no_fresh_content" 
        : "not_enough_fresh_content";
      
      console.log(`⚠️ Not enough fresh content (latest=${latestStoryCount}, later=${laterItemCount}, incidents=${incidentCount}), skipping newsletter`);
      
      const { data: skippedNewsletter, error: skipError } = await supabase
        .from("newsletters")
        .insert({
          edition_date: editionDate,
          status: "skipped",
          subject: `Lake Geneva Local - ${editionDate} (Skipped)`,
          preheader: "Not enough fresh content today",
          html_body: "<p>No newsletter generated – not enough fresh content available.</p>",
          text_body: "No newsletter generated – not enough fresh content available.",
          story_ids: [],
          story_count: 0,
          metadata: { 
            skipped_reason: skipReason,
            latest_story_count: latestStoryCount,
            later_item_count: laterItemCount,
            incident_count: incidentCount,
            freshness_window_hours: freshnessWindowHours,
            live_fetch_failed: liveFetchFailed
          }
        })
        .select()
        .single();

      if (skipError) throw skipError;

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Newsletter skipped: ${skipReason}`,
          newsletter_id: skippedNewsletter.id,
          status: "skipped",
          latest_story_count: latestStoryCount,
          later_item_count: laterItemCount,
          incident_count: incidentCount,
          freshness_window_hours: freshnessWindowHours
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`✅ Found ${candidates.length} eligible stories`);

    // ========== EVERGREEN FALLBACK ==========
    // If we have fewer than MIN_EVENTS upcoming events, inject evergreen content
    // Threshold set to 9 so evergreen fires when we have 8 or fewer events
    const MIN_EVENTS_THRESHOLD = 9;
    const eventCandidates = candidates.filter(s => s.category === "events" && s.event_date);
    let evergreenItems: any[] = [];
    
    if (eventCandidates.length < MIN_EVENTS_THRESHOLD) {
      console.log(`📚 Low event count (${eventCandidates.length} < ${MIN_EVENTS_THRESHOLD}), fetching evergreen content...`);
      
      // Determine current season
      const month = today.getMonth() + 1;
      let currentSeason = "all";
      if (month >= 12 || month <= 2) currentSeason = "winter";
      else if (month >= 3 && month <= 5) currentSeason = "spring";
      else if (month >= 6 && month <= 8) currentSeason = "summer";
      else currentSeason = "fall";
      
      const evergreenNeeded = Math.min(3, MIN_EVENTS_THRESHOLD - eventCandidates.length);
      
      const { data: evergreen } = await supabase
        .from("evergreen_content")
        .select("id, title, content, category")
        .eq("is_active", true)
        .or(`season.eq.all,season.eq.${currentSeason}`)
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .order("priority", { ascending: false })
        .limit(evergreenNeeded);
      
      if (evergreen && evergreen.length > 0) {
        evergreenItems = evergreen;
        console.log(`✅ Adding ${evergreenItems.length} evergreen items: ${evergreenItems.map(e => e.title).join(", ")}`);
        
        // Update usage tracking - simple update without RPC
        const evergreenIds = evergreenItems.map(e => e.id);
        for (const evId of evergreenIds) {
          await supabase
            .from("evergreen_content")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", evId);
        }
      }
    }

    // Rank and pick top stories
    const rankedStories = rankStories(candidates as Story[], 12);
    const selectedStories = rankedStories.slice(0, 12);

    console.log(`📊 Selected ${selectedStories.length} stories + ${evergreenItems.length} evergreen for newsletter`);

    // Ensure voice exists for all stories
    console.log("🎤 Ensuring voice generation for all stories...");
    await ensureVoiceForStories(supabase, selectedStories);

    // Optimize newsletter flow
    console.log("✨ Optimizing newsletter flow...");
    const storyIds = selectedStories.map(s => s.id);
    
    const { data: optimizeData, error: optimizeError } = await supabase.functions.invoke(
      "optimize-newsletter-flow",
      { 
        body: { storyIds },
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      }
    );

    if (optimizeError) {
      console.error("Optimize flow error:", optimizeError);
      console.error("Optimize flow error details:", JSON.stringify(optimizeError, null, 2));
      // If optimization fails, continue with existing newsletter voices
      console.log("⚠️ Optimization failed, using existing content_newsletter values");
    }

    const optimizedStories = optimizeData?.optimizedStories ?? [];
    console.log(`✅ Optimized ${optimizedStories.length} stories`);

    // Check for active sponsor placements
    console.log("💰 Checking for active sponsor placements...");
    const { data: activePlacements } = await supabase
      .from("ad_placements")
      .select("*, business_profiles(*), ad_slots(*)")
      .eq("status", "active")
      .lte("start_date", editionDate)
      .gte("end_date", editionDate);

    const headerSponsor = activePlacements?.find(p => p.slot_id === "newsletter_header");

    // Fetch approved job listings for "Now Hiring" section
    console.log("💼 Fetching approved job listings...");
    const { data: jobListings } = await supabase
      .from("job_listings")
      .select("id, title, business_name, category, job_type, pay_display, location_text, apply_url, contact_email, is_featured")
      .eq("status", "approved")
      .gt("expires_at", today.toISOString())
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    console.log(`✅ Found ${jobListings?.length || 0} job listings for newsletter`);

    // Fetch Community Advocates (subscribers with 3+ referrals)
    console.log("🌟 Fetching community advocates...");
    const { data: advocates } = await supabase
      .from("subscribers")
      .select("email, referral_count")
      .eq("status", "active")
      .gte("referral_count", 3)
      .order("referral_count", { ascending: false })
      .limit(10);

    console.log(`✅ Found ${advocates?.length || 0} advocates for newsletter`);

    // Build newsletter - route based on feature flag
    let newsletter: { subject: string; preheader: string; htmlBody: string; textBody: string };
    
    if (useV2) {
      console.log("📝 Building newsletter content (V2: LIVE · LATEST · LATER)...");
      newsletter = buildNewsletterV2({
        latestStories: selectedStories,
        optimizedStories,
        editionDate,
        sponsor: headerSponsor,
        evergreen: evergreenItems,
        jobs: jobListings || [],
        advocates: advocates || [],
        // V2 additions
        liveIncidents,
        liveFetchFailed,
        laterPick,
        laterPickReason,
        tonightSchedule,
        weekendEvents,
        isWeekendSendDay
      });
    } else {
      console.log("📝 Building newsletter content (V1: legacy structure)...");
      newsletter = buildNewsletter(
        selectedStories,
        optimizedStories,
        editionDate,
        headerSponsor,
        evergreenItems,
        jobListings || [],
        advocates || []
      );
    }

    // Compute briefingStories for metadata (same logic as buildNewsletterV2)
    const briefingStories = selectedStories.filter(s => s.category !== "events").slice(0, 5);
    
    // Save newsletter to database with version tagging
    const versionTag = useV2 ? "v2_live_latest_later" : "v1_legacy";
    console.log(`💾 Saving newsletter to database (${versionTag})...`);
    const { data: savedNewsletter, error: saveError } = await supabase
      .from("newsletters")
      .insert({
        edition_date: editionDate,
        status: "ready",
        subject: newsletter.subject,
        preheader: newsletter.preheader,
        html_body: newsletter.htmlBody.replace(/\{\{NEWSLETTER_ID\}\}/g, "PLACEHOLDER"), // Temporary placeholder
        text_body: newsletter.textBody,
        story_ids: storyIds,
        story_count: selectedStories.length,
        auto_send_enabled: sendNow,
        metadata: useV2 ? { 
          version: versionTag,
          categories: getCategoryCounts(selectedStories),
          generated_at: new Date().toISOString(),
          evergreen_count: evergreenItems.length,
          evergreen_ids: evergreenItems.map(e => e.id),
          evergreen_titles: evergreenItems.map(e => e.title),
          // V2 section counts for analytics
          live_incident_count: incidentCount,
          live_fetch_failed: liveFetchFailed,
          latest_story_count: briefingStories.length,
          later_pick_title: laterPick?.title || null,
          later_pick_reason: laterPickReason || null,
          tonight_count: tonightSchedule.length,
          weekend_count: weekendEvents.length,
          is_weekend_send: isWeekendSendDay
        } : {
          version: versionTag,
          categories: getCategoryCounts(selectedStories),
          generated_at: new Date().toISOString(),
          evergreen_count: evergreenItems.length
        }
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Replace newsletter ID placeholder in HTML
    const finalHtmlBody = newsletter.htmlBody.replace(/\{\{NEWSLETTER_ID\}\}/g, savedNewsletter.id);
    
    // Update newsletter with final HTML containing real newsletter ID
    const { error: updateHtmlError } = await supabase
      .from("newsletters")
      .update({ html_body: finalHtmlBody })
      .eq("id", savedNewsletter.id);

    if (updateHtmlError) {
      console.error("Failed to update newsletter HTML:", updateHtmlError);
    }

    // Update stories with newsletter reference (dedupe marker) + auto-mark as published
    console.log("🔗 Updating stories with newsletter reference + marking as auto_published...");
    const { error: updateError } = await supabase
      .from("content_queue")
      .update({ 
        last_newsletter_id: savedNewsletter.id,
        status: "auto_published"
      })
      .in("id", storyIds);

    if (updateError) throw updateError;
    
    // Log newsletter generation to activity log
    const versionLabel = useV2 ? 'V2' : 'V1';
    const logMessage = useV2 
      ? `Newsletter ${versionLabel} generated: ${briefingStories.length} LATEST, ${incidentCount} LIVE, ${tonightSchedule.length + (laterPick ? 1 : 0)} LATER`
      : `Newsletter ${versionLabel} generated: ${selectedStories.length} stories`;
    
    await supabase.from("activity_log").insert({
      action: "newsletter_generated",
      entity_type: "newsletter",
      entity_id: savedNewsletter.id,
      actor_type: "system",
      message: logMessage,
      details: useV2 ? {
        version: versionTag,
        live_count: incidentCount,
        live_fetch_failed: liveFetchFailed,
        latest_count: briefingStories.length,
        later_pick: laterPick?.title || null,
        tonight_count: tonightSchedule.length,
        weekend_count: weekendEvents.length,
        story_ids: storyIds
      } : {
        version: versionTag,
        story_count: selectedStories.length,
        story_ids: storyIds
      }
    });

    // Check if auto-send is enabled for this newsletter
    const shouldSend = savedNewsletter.auto_send_enabled === true;

    if (shouldSend) {
      console.log("📧 Auto-send enabled, sending newsletter...");
      const { sent, failed, errors, subscriberCount } = await sendNewsletterEmail(supabase, savedNewsletter, supabaseUrl);
      
      console.log(`📧 Send result: sent=${sent}, failed=${failed}, subscriberCount=${subscriberCount}`);
      
      if (sent > 0) {
        await supabase
          .from("newsletters")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", savedNewsletter.id);
        
        console.log(`✅ Newsletter sent to ${sent} subscribers (${failed} failed)`);
        
        return new Response(
          JSON.stringify({
            success: true,
            newsletter_id: savedNewsletter.id,
            status: "sent",
            story_count: selectedStories.length,
            subject: newsletter.subject,
            sent_count: sent,
            failed_count: failed,
            subscriber_count: subscriberCount,
            message: `Newsletter sent to ${sent} subscribers`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } else {
        // Send failed - log errors but still return the newsletter info
        console.log(`⚠️ Send failed. Errors: ${JSON.stringify(errors)}`);
        return new Response(
          JSON.stringify({
            success: false,
            newsletter_id: savedNewsletter.id,
            status: "ready",
            story_count: selectedStories.length,
            subject: newsletter.subject,
            message: errors.length > 0 ? errors[0] : "No emails were sent",
            errors: errors,
            subscriber_count: subscriberCount,
            hint: "Check the errors array for details"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } else {
      console.log("📧 Auto-send disabled, newsletter saved as 'ready'");
    }

    console.log(`✅ Newsletter generated successfully! ID: ${savedNewsletter.id}`);
    console.log(`📧 Status: ${savedNewsletter.status}`);

    return new Response(
      JSON.stringify({
        success: true,
        newsletter_id: savedNewsletter.id,
        status: savedNewsletter.status,
        story_count: selectedStories.length,
        subject: newsletter.subject,
        message: "Newsletter generated successfully (email sending disabled)"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Autopilot newsletter error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Convert category to Title Case (e.g., "real-estate" -> "Real Estate")
function toTitleCase(str: string): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Rank stories by priority: approved first, category diversity, then recency
function rankStories(stories: Story[], limit: number): Story[] {
  // Priority scoring
  const scored = stories.map(s => {
    let score = 0;
    
    // Status priority
    if (s.status === "approved") score += 100;
    else if (s.status === "auto_published") score += 50;
    else if (s.status === "published") score += 75;
    
    // Recency (more recent = higher score)
    const ageHours = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 20 - ageHours / 24); // 0-20 points based on age
    
    return { story: s, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Apply category diversity (max 5 per category)
  const categoryCounts: Record<string, number> = {};
  const selected: Story[] = [];

  for (const item of scored) {
    const category = item.story.category || "uncategorized";
    const count = categoryCounts[category] || 0;

    if (count < 5) {
      selected.push(item.story);
      categoryCounts[category] = count + 1;
    }

    if (selected.length >= limit) break;
  }

  return selected;
}

// Ensure voice generation for stories missing content_newsletter
async function ensureVoiceForStories(supabase: any, stories: Story[]) {
  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];

    if (story.content_newsletter && story.voice_generated_at) {
      console.log(`✓ Story ${i + 1}/${stories.length}: Voice already exists`);
      continue;
    }

    console.log(`🎤 Story ${i + 1}/${stories.length}: Generating voice for "${story.title.substring(0, 50)}..."`);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const { error } = await supabase.functions.invoke("transform-voice", {
      body: { mode: "single", id: story.id },
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });

    if (error) {
      console.error(`❌ Failed to generate voice for story ${story.id}:`, error);
      // Continue anyway - story will use summary as fallback
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Build newsletter HTML and text
function buildNewsletter(
  stories: Story[],
  optimized: { id: string; newsletter_voice: string }[],
  editionDate: string,
  sponsor?: any,
  evergreen?: { id: string; title: string; content: string; category: string }[],
  jobs?: { id: string; title: string; business_name: string; category: string; job_type: string; pay_display: string | null; location_text: string | null; apply_url: string | null; contact_email: string; is_featured: boolean | null }[],
  advocates?: { email: string; referral_count: number }[]
) {
  const optimizedMap = new Map(optimized.map(o => [o.id, o.newsletter_voice]));

  // Format date
  const date = new Date(editionDate);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const subject = `Lake Geneva This Week – ${dateLabel}`;
  const preheader = stories[0]?.title || "Your weekly roundup of local news and events";

  // Group by category
  const grouped: Record<string, Story[]> = {};
  stories.forEach(s => {
    const cat = s.category || "Community";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  // Category emoji map
  const categoryEmoji: Record<string, string> = {
    events: "📅",
    news: "📰",
    dining: "🍽️",
    community: "🏘️",
    "real-estate": "🏡"
  };

  // Build At-a-Glance section (scannable summary)
  const atAGlanceItems = Object.entries(grouped).flatMap(([category, categoryStories]) => {
    return categoryStories.map(s => {
      // Extract date/time/venue from content_newsletter or summary
      const content = s.content_newsletter || s.summary || "";
      return {
        title: s.title,
        category: category,
        content: content
      };
    });
  });

  const atAGlanceHtml = `
    <div style="margin-bottom: 32px; padding: 20px; background-color: #f7fafc; border-left: 4px solid #667eea; border-radius: 4px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #2d3748;">
        📋 This Week at a Glance
      </h2>
      ${Object.entries(grouped).map(([category, categoryStories]) => {
        const categoryItems = categoryStories.map(s => {
          const title = escapeHtml(s.title);
          const linkHtml = s.original_url 
            ? ` <a href="${escapeHtml(s.original_url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500;">→ Details</a>`
            : '';
          return `<li style="margin-bottom: 6px; font-size: 14px; line-height: 1.5; color: #4a5568;"><strong>${title}</strong>${linkHtml}</li>`;
        }).join("\n");
        return `
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #718096; letter-spacing: 0.5px;">${toTitleCase(category)}</p>
            <ul style="margin: 0; padding-left: 20px;">
              ${categoryItems}
            </ul>
          </div>
        `;
      }).join("\n")}
    </div>
  `;

  // Build HTML sections
  const htmlSections = Object.entries(grouped).map(([category, categoryStories]) => {
    const emoji = categoryEmoji[category.toLowerCase()] || "📌";
    const items = categoryStories.map(s => {
      const rawContent = s.content ?? "";
      const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 200);
      const linkHtml = s.original_url 
        ? `<div style="margin-top: 8px;"><a href="${escapeHtml(s.original_url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500;">More info →</a></div>`
        : '';
      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1a202c;">${escapeHtml(s.title)}</h3>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a5568;">${escapeHtml(body)}</p>
          ${linkHtml}
        </div>
      `;
    }).join("\n");

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          ${emoji} ${toTitleCase(category)}
        </h2>
        ${items}
      </div>
    `;
  }).join("\n");

  // Build evergreen section if provided
  const evergreenHtml = evergreen && evergreen.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #fef3c7; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #92400e;">
        ✨ Local Favorites
      </h2>
      ${evergreen.map(item => `
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #fcd34d;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #78350f;">${escapeHtml(item.title)}</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">${escapeHtml(item.content)}</p>
        </div>
      `).join("\n")}
    </div>
  ` : "";

  // Build "Now Hiring" jobs section
  const jobCategoryEmoji: Record<string, string> = {
    hospitality: "🍽️",
    retail: "🛍️",
    trades: "🔧",
    services: "✂️",
    healthcare: "🏥",
    office: "💼",
    other: "💼"
  };

  const jobsHtml = jobs && jobs.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #e0f2fe; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0369a1;">
        💼 Now Hiring in Lake Geneva
      </h2>
      ${jobs.map(job => {
        const emoji = jobCategoryEmoji[job.category?.toLowerCase()] || "💼";
        const payInfo = job.pay_display ? `<span style="color: #0284c7; font-weight: 500;">${escapeHtml(job.pay_display)}</span>` : '';
        const locationInfo = job.location_text ? ` • ${escapeHtml(job.location_text)}` : '';
        const applyUrl = job.apply_url || `mailto:${job.contact_email}`;
        const featuredBadge = job.is_featured ? '<span style="background-color: #fbbf24; color: #78350f; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">FEATURED</span>' : '';
        return `
          <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #7dd3fc;">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #0c4a6e;">
              ${emoji} ${escapeHtml(job.title)}${featuredBadge}
            </h3>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #0369a1;">
              <strong>${escapeHtml(job.business_name)}</strong>${locationInfo}
            </p>
            <p style="margin: 0; font-size: 13px; color: #0284c7;">
              ${escapeHtml(job.job_type)}${payInfo ? ` • ${payInfo}` : ''}
              <a href="${escapeHtml(applyUrl)}" data-job-id="${job.id}" target="_blank" rel="noopener noreferrer" style="color: #0369a1; text-decoration: none; font-weight: 500; margin-left: 8px;">Apply →</a>
            </p>
          </div>
        `;
      }).join("")}
      <p style="margin: 16px 0 0 0; font-size: 13px; text-align: center;">
        <a href="https://lakegeneva.news/jobs" target="_blank" rel="noopener noreferrer" style="color: #0369a1; text-decoration: none; font-weight: 600;">
          View all local job openings →
        </a>
      </p>
    </div>
  ` : "";

  // Build Community Advocates section
  const advocatesHtml = advocates && advocates.length > 0 ? (() => {
    // Convert emails to first name + last initial (e.g., "sarah.miller@email.com" -> "Sarah M.")
    const advocateNames = advocates.map(a => {
      const emailLocal = a.email.split("@")[0];
      // Try to extract name from email (common patterns: john.doe, johndoe, john_doe)
      const parts = emailLocal.split(/[._-]/).filter(Boolean);
      if (parts.length >= 2) {
        const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
        return `${firstName} ${lastInitial}.`;
      } else if (parts.length === 1 && parts[0].length > 2) {
        // Single word email - just capitalize first letter
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 3).toLowerCase() + ".";
      }
      return "Reader";
    }).filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

    return `
      <div style="margin-bottom: 32px; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #92400e;">
          🌟 Community Advocates
        </h2>
        <p style="margin: 0; font-size: 14px; color: #78350f;">
          These readers help spread local news: ${advocateNames.join(", ")}
        </p>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #92400e;">
          <a href="https://lakegeneva.news?ref=newsletter" style="color: #92400e; text-decoration: underline;">
            Refer friends and join them! →
          </a>
        </p>
      </div>
    `;
  })() : "";

  // Build sponsor block if present
  const sponsorBlock = sponsor ? `
    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        ${sponsor.business_profiles.logo_url ? `
          <img src="${sponsor.business_profiles.logo_url}" 
               alt="${sponsor.business_profiles.name}" 
               style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px;" />
        ` : ''}
        <div>
          <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Presented By</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
            ${sponsor.label || sponsor.business_profiles.name}
          </p>
          ${sponsor.business_profiles.website ? `
            <a href="https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.business_profiles.website)}&source=newsletter_sponsor&bid=${sponsor.business_id}&pid=${sponsor.id}&nid={{NEWSLETTER_ID}}" 
               style="color: #667eea; text-decoration: none; font-size: 14px;">
              Visit Website →
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  ` : '';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="padding: 32px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Lake Geneva Local</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${dateLabel}</p>
    </div>
    
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #4a5568;">
        Good morning, Lake Geneva! 👋<br>
        Here's what's happening around town this week.
      </p>
      
      ${sponsorBlock}
      
      ${atAGlanceHtml}
      
      ${htmlSections}
      
      ${evergreenHtml}
      
      ${jobsHtml}
      
      ${advocatesHtml}
      
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #718096;">
          You're receiving this because you subscribed to Lake Geneva Local.<br>
          <a href="#" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text At-a-Glance
  const atAGlanceText = Object.entries(grouped).map(([category, categoryStories]) => {
    const items = categoryStories.map(s => {
      const urlSuffix = s.original_url ? ` — ${s.original_url}` : '';
      return `• ${s.title}${urlSuffix}`;
    }).join("\n");
    return `${toTitleCase(category)}\n${items}`;
  }).join("\n\n");

  // Build plain text
  const textSections = Object.entries(grouped).map(([category, categoryStories]) => {
    const items = categoryStories.map(s => {
      const rawContent = s.content ?? "";
      const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 200);
      const urlSuffix = s.original_url ? `\nMore info: ${s.original_url}` : '';
      return `${s.title}\n${body}${urlSuffix}\n`;
    }).join("\n");

    return `== ${toTitleCase(category)} ==\n\n${items}`;
  }).join("\n\n");

  // Build plain text evergreen
  const evergreenText = evergreen && evergreen.length > 0 ? `
== LOCAL FAVORITES ==

${evergreen.map(item => `${item.title}\n${item.content}`).join("\n\n")}
` : "";

  // Build plain text jobs
  const jobsText = jobs && jobs.length > 0 ? `
== NOW HIRING IN LAKE GENEVA ==

${jobs.map(job => {
  const payInfo = job.pay_display ? ` | ${job.pay_display}` : '';
  const locationInfo = job.location_text ? ` | ${job.location_text}` : '';
  const applyUrl = job.apply_url || `mailto:${job.contact_email}`;
  return `• ${job.title} at ${job.business_name}
  ${job.job_type}${payInfo}${locationInfo}
  Apply: ${applyUrl}`;
}).join("\n\n")}

View all jobs: https://lakegeneva.news/jobs
` : "";

  const textBody = `
LAKE GENEVA LOCAL
${dateLabel}

Good morning, Lake Geneva! 👋
Here's what's happening around town this week.

== THIS WEEK AT A GLANCE ==

${atAGlanceText}

${textSections}
${evergreenText}
${jobsText}
---
You're receiving this because you subscribed to Lake Geneva Local.
Unsubscribe: [link]
  `.trim();

  return { subject, preheader, htmlBody, textBody };
}

// ============= V2 NEWSLETTER BUILDER (LIVE · LATEST · LATER) =============

interface NewsletterV2Params {
  latestStories: Story[];
  optimizedStories: { id: string; newsletter_voice: string }[];
  editionDate: string;
  sponsor?: any;
  evergreen?: { id: string; title: string; content: string; category: string }[];
  jobs?: any[];
  advocates?: { email: string; referral_count: number }[];
  // V2 additions
  liveIncidents: Incident[];
  liveFetchFailed: boolean;
  laterPick: LaterEvent | null;
  laterPickReason: string;
  tonightSchedule: LaterEvent[];
  weekendEvents: LaterEvent[];
  isWeekendSendDay: boolean;
}

function buildNewsletterV2(params: NewsletterV2Params) {
  const {
    latestStories,
    optimizedStories,
    editionDate,
    sponsor,
    evergreen,
    jobs,
    advocates,
    liveIncidents,
    liveFetchFailed,
    laterPick,
    laterPickReason,
    tonightSchedule,
    weekendEvents,
    isWeekendSendDay
  } = params;

  const optimizedMap = new Map(optimizedStories.map(o => [o.id, o.newsletter_voice]));

  // Format date
  const date = new Date(editionDate);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const subject = `Lake Geneva Brief – ${dateLabel}`;
  const preheader = latestStories[0]?.title || "Your daily Lake Geneva update";

  // ========== LIVE SECTION (Conditional) ==========
  // Only include if there are active incidents
  const liveHtml = liveIncidents.length > 0 ? `
    <div style="margin-bottom: 24px; padding: 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #dc2626;">
        🔴 LIVE Updates
      </h2>
      ${liveIncidents.map(incident => `
        <div style="margin-bottom: 12px;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">
            ${escapeHtml(incident.title)}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #b91c1c;">
            ${incident.incident_type ? toTitleCase(incident.incident_type) : 'Update'} · 
            <a href="https://lakegeneva.news/v2/incidents/${incident.id}" style="color: #dc2626; text-decoration: none;">Details →</a>
          </p>
        </div>
      `).join("")}
    </div>
  ` : '';

  // Log LIVE section status for debugging
  if (liveFetchFailed) {
    console.log("⚠️ LIVE section omitted due to fetch failure");
  } else if (liveIncidents.length === 0) {
    console.log("ℹ️ LIVE section omitted - no active incidents");
  }

  // ========== LATEST SECTION (The Briefing) ==========
  // Filter to non-event stories for the briefing (max 5)
  const briefingStories = latestStories
    .filter(s => s.category !== "events")
    .slice(0, 5);

  const latestHtml = briefingStories.length > 0 ? `
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        📰 LATEST
      </h2>
      ${briefingStories.map(s => {
        const rawContent = s.content ?? "";
        const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || rawContent.substring(0, 150);
        const linkHtml = s.original_url 
          ? ` <a href="${escapeHtml(s.original_url)}" style="color: #667eea; text-decoration: none; font-weight: 500;">Read more →</a>`
          : '';
        return `
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #1a202c;">${escapeHtml(s.title)}</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4a5568;">${escapeHtml(body)}${linkHtml}</p>
          </div>
        `;
      }).join("")}
    </div>
  ` : '';

  // ========== LATER SECTION (Decision Support) ==========
  let laterHtml = '';
  
  // Pick of the Day
  const pickHtml = laterPick ? (() => {
    const venue = extractVenue(laterPick.title) || laterPick.title;
    const performer = laterPick.performer || extractPerformerFromTitle(laterPick.title);
    const eventDate = laterPick.event_date;
    
    // Format day label
    let dayLabel = 'Soon';
    if (eventDate) {
      const eventDateObj = new Date(eventDate + 'T12:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (eventDateObj.toDateString() === today.toDateString()) dayLabel = 'Today';
      else if (eventDateObj.toDateString() === tomorrow.toDateString()) dayLabel = 'Tomorrow';
      else dayLabel = eventDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    const timeLabel = laterPick.event_time ? ` at ${laterPick.event_time}` : '';
    
    return `
      <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border-radius: 8px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.1em;">
          ⭐ PICK OF THE DAY
        </p>
        ${laterPick.original_url ? `
          <a href="${escapeHtml(laterPick.original_url)}" style="text-decoration: none;">
            <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #78350f;">${escapeHtml(venue)}</h3>
          </a>
        ` : `
          <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #78350f;">${escapeHtml(venue)}</h3>
        `}
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          ${performer ? escapeHtml(performer) + ' · ' : ''}${dayLabel}${timeLabel}
        </p>
      </div>
    `;
  })() : '';

  // Tonight's Schedule
  const tonightHtml = tonightSchedule.length > 0 ? `
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
        🌙 Tonight
      </p>
      ${tonightSchedule.map(event => {
        const venue = extractVenue(event.title) || event.title;
        const time = event.event_time || '';
        return `
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #4a5568;">
            ${time ? `<span style="color: #667eea; font-weight: 500;">${time}</span> – ` : '• '}
            ${event.original_url 
              ? `<a href="${escapeHtml(event.original_url)}" style="color: #1a202c; text-decoration: none;">${escapeHtml(venue)}</a>`
              : escapeHtml(venue)
            }
          </p>
        `;
      }).join("")}
    </div>
  ` : '';

  // Weekend Preview (Thu/Fri only)
  const weekendHtml = isWeekendSendDay && weekendEvents.length > 0 ? `
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
        📅 This Weekend
      </p>
      ${weekendEvents.slice(0, 4).map(event => {
        const venue = extractVenue(event.title) || event.title;
        const dayName = event.event_date ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : '';
        const time = event.event_time || '';
        return `
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #4a5568;">
            ${dayName ? `<span style="color: #667eea; font-weight: 500;">${dayName}</span> ` : ''}
            ${time ? `${time} – ` : ''}
            ${event.original_url 
              ? `<a href="${escapeHtml(event.original_url)}" style="color: #1a202c; text-decoration: none;">${escapeHtml(venue)}</a>`
              : escapeHtml(venue)
            }
          </p>
        `;
      }).join("")}
    </div>
  ` : '';

  // Combine LATER section
  if (pickHtml || tonightHtml || weekendHtml) {
    laterHtml = `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          📅 LATER
        </h2>
        ${pickHtml}
        ${tonightHtml}
        ${weekendHtml}
      </div>
    `;
  }

  // ========== EXISTING SECTIONS (Jobs, Evergreen, Advocates) ==========
  // Build evergreen section
  const evergreenHtml = evergreen && evergreen.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #f0fdf4; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #166534;">
        ✨ Local Favorites
      </h2>
      ${evergreen.map(item => `
        <div style="margin-bottom: 12px;">
          <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #15803d;">${escapeHtml(item.title)}</h3>
          <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #166534;">${escapeHtml(item.content)}</p>
        </div>
      `).join("")}
    </div>
  ` : "";

  // Build jobs section
  const jobsHtml = jobs && jobs.length > 0 ? `
    <div style="margin-bottom: 32px; background-color: #e0f2fe; border-radius: 8px; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0369a1;">
        💼 Now Hiring
      </h2>
      ${jobs.map((job: any) => {
        const applyUrl = job.apply_url || `mailto:${job.contact_email}`;
        return `
          <div style="margin-bottom: 12px;">
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0c4a6e;">
              ${escapeHtml(job.title)} 
              <span style="font-weight: 400; color: #0369a1;">at ${escapeHtml(job.business_name)}</span>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #0284c7;">
              <a href="${escapeHtml(applyUrl)}" data-job-id="${job.id}" style="color: #0369a1; text-decoration: none;">Apply →</a>
            </p>
          </div>
        `;
      }).join("")}
    </div>
  ` : "";

  // Build advocates section
  const advocatesHtml = advocates && advocates.length > 0 ? (() => {
    const advocateNames = advocates.map(a => {
      const emailLocal = a.email.split("@")[0];
      const parts = emailLocal.split(/[._-]/).filter(Boolean);
      if (parts.length >= 2) {
        const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
        return `${firstName} ${lastInitial}.`;
      } else if (parts.length === 1 && parts[0].length > 2) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 3).toLowerCase() + ".";
      }
      return "Reader";
    }).filter((name, index, self) => self.indexOf(name) === index);

    return `
      <div style="margin-bottom: 24px; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          🌟 <strong>Community Advocates:</strong> ${advocateNames.join(", ")}
          <a href="https://lakegeneva.news?ref=newsletter" style="color: #92400e; text-decoration: underline; margin-left: 8px;">Join them →</a>
        </p>
      </div>
    `;
  })() : "";

  // Build sponsor block
  const sponsorBlock = sponsor ? `
    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px; margin: 16px 0; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${sponsor.business_profiles?.logo_url ? `
          <img src="${sponsor.business_profiles.logo_url}" 
               alt="${sponsor.business_profiles.name}" 
               style="width: 48px; height: 48px; object-fit: contain; border-radius: 4px;" />
        ` : ''}
        <div>
          <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Presented By</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
            ${sponsor.label || sponsor.business_profiles?.name || 'Sponsor'}
          </p>
          ${sponsor.business_profiles?.website ? `
            <a href="https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.business_profiles.website)}&source=newsletter_sponsor&bid=${sponsor.business_id}&pid=${sponsor.id}&nid={{NEWSLETTER_ID}}" 
               style="color: #667eea; text-decoration: none; font-size: 13px;">Visit Website →</a>
          ` : ''}
        </div>
      </div>
    </div>
  ` : '';

  // ========== FINAL HTML ==========
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="padding: 24px 20px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Lake Geneva Brief</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">${dateLabel}</p>
    </div>
    
    <div style="padding: 24px 20px;">
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5; color: #4a5568;">
        Good morning, Lake Geneva! 👋
      </p>
      
      ${sponsorBlock}
      
      ${liveHtml}
      
      ${latestHtml}
      
      ${laterHtml}
      
      ${evergreenHtml}
      
      ${jobsHtml}
      
      ${advocatesHtml}
      
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #718096;">
          You subscribed to Lake Geneva Brief.<br>
          <a href="[UNSUBSCRIBE_URL]" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  // ========== PLAIN TEXT VERSION ==========
  const liveText = liveIncidents.length > 0 
    ? `== LIVE UPDATES ==\n\n${liveIncidents.map(i => `• ${i.title}\n  Details: https://lakegeneva.news/v2/incidents/${i.id}`).join("\n")}\n\n` 
    : '';

  const latestText = briefingStories.length > 0
    ? `== LATEST ==\n\n${briefingStories.map(s => {
        const body = optimizedMap.get(s.id) || s.content_newsletter || s.summary || '';
        return `${s.title}\n${body}${s.original_url ? `\n${s.original_url}` : ''}\n`;
      }).join("\n")}\n`
    : '';

  const laterText = (() => {
    let text = '';
    if (laterPick || tonightSchedule.length > 0 || weekendEvents.length > 0) {
      text += '== LATER ==\n\n';
      if (laterPick) {
        const venue = extractVenue(laterPick.title) || laterPick.title;
        text += `⭐ PICK: ${venue}${laterPick.event_time ? ` at ${laterPick.event_time}` : ''}\n\n`;
      }
      if (tonightSchedule.length > 0) {
        text += 'TONIGHT:\n';
        text += tonightSchedule.map(e => `• ${e.event_time || ''} ${extractVenue(e.title) || e.title}`).join("\n");
        text += '\n\n';
      }
      if (isWeekendSendDay && weekendEvents.length > 0) {
        text += 'THIS WEEKEND:\n';
        text += weekendEvents.slice(0, 4).map(e => `• ${extractVenue(e.title) || e.title}`).join("\n");
        text += '\n\n';
      }
    }
    return text;
  })();

  const jobsText = jobs && jobs.length > 0 
    ? `== NOW HIRING ==\n\n${jobs.map((j: any) => `• ${j.title} at ${j.business_name}`).join("\n")}\n\n`
    : '';

  const textBody = `
LAKE GENEVA BRIEF
${dateLabel}

Good morning, Lake Geneva! 👋

${liveText}${latestText}${laterText}${jobsText}---
Unsubscribe: [UNSUBSCRIBE_URL]
  `.trim();

  return { subject, preheader, htmlBody, textBody };
}

// Get category counts for metadata
function getCategoryCounts(stories: Story[]): Record<string, number> {
  const counts: Record<string, number> = {};
  stories.forEach(s => {
    const cat = s.category || "uncategorized";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

// Escape HTML entities
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Add tracking pixel to HTML
function addTrackingPixel(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  const trackingPixelUrl = `${baseUrl}/functions/v1/track-open?nid=${newsletterId}&sid=${subscriberId}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;" />`;
  
  // Insert before </body> if exists, otherwise at end
  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${trackingPixel}</body>`);
  }
  return htmlBody + trackingPixel;
}

// Rewrite all links to use click tracking
function rewriteLinksForTracking(htmlBody: string, newsletterId: string, subscriberId: string, baseUrl: string): string {
  // Match <a> tags with href and optional data-job-id attributes
  const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
  
  return htmlBody.replace(linkRegex, (match, before, url, after) => {
    // Skip tracking for unsubscribe links, anchors, mailto, tel, and links already using track-click
    if (url.includes('unsubscribe') || 
        url.startsWith('#') || 
        url.startsWith('mailto:') || 
        url.startsWith('tel:') ||
        url.includes('/track-click?')) {
      return match;
    }
    
    // Check for job ID in the data attribute
    const jobIdMatch = (before + after).match(/data-job-id=["']([^"']+)["']/);
    const jobId = jobIdMatch ? jobIdMatch[1] : null;
    
    // Build tracking URL
    const encodedUrl = encodeURIComponent(url);
    let trackingUrl = `${baseUrl}/functions/v1/track-click?nid=${newsletterId}&sid=${subscriberId}&url=${encodedUrl}`;
    
    // Add job ID if present
    if (jobId) {
      trackingUrl += `&jid=${jobId}`;
    }
    
    // Remove data-job-id from output (it was only for tracking purposes)
    const cleanedBefore = before.replace(/data-job-id=["'][^"']*["']\s*/gi, '');
    const cleanedAfter = after.replace(/data-job-id=["'][^"']*["']\s*/gi, '');
    
    return `<a ${cleanedBefore}href="${trackingUrl}"${cleanedAfter}>`;
  });
}

// Send newsletter email via Resend
async function sendNewsletterEmail(
  supabase: any,
  newsletter: any,
  baseUrl: string
): Promise<{ sent: number; failed: number; errors: string[]; subscriberCount: number }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const errors: string[] = [];
  
  if (!resendApiKey) {
    console.log("⚠️ RESEND_API_KEY not configured, skipping send");
    errors.push("RESEND_API_KEY not configured");
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
  }

  const resend = new Resend(resendApiKey);

  // Fetch active subscribers
  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active");
    // Future: .eq("city_id", newsletter.city_id) for multi-city

  if (error) {
    console.log("⚠️ Failed to fetch subscribers:", error);
    errors.push(`Failed to fetch subscribers: ${error.message}`);
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
  }
  
  if (!subscribers?.length) {
    console.log("⚠️ No active subscribers found");
    errors.push("No active subscribers found");
    return { sent: 0, failed: 0, errors, subscriberCount: 0 };
  }

  console.log(`📧 Sending to ${subscribers.length} subscribers...`);

  // Batch in chunks of 100 for Resend limits
  const BATCH_SIZE = 100;
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    for (const subscriber of batch) {
      try {
        const unsubscribeUrl = `${baseUrl}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`;
        
        // Replace unsubscribe placeholder
        let htmlBody = newsletter.html_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );
        const textBody = newsletter.text_body.replace(
          /\[UNSUBSCRIBE_URL\]/g,
          unsubscribeUrl
        );

        // Add tracking pixel and rewrite links
        htmlBody = rewriteLinksForTracking(htmlBody, newsletter.id, subscriber.id, baseUrl);
        htmlBody = addTrackingPixel(htmlBody, newsletter.id, subscriber.id, baseUrl);

        const { error: sendError } = await resend.emails.send({
          from: "Lake Geneva Brief <newsletter@citybrief.info>",
          to: subscriber.email,
          subject: newsletter.subject,
          html: htmlBody,
          text: textBody,
        });

        if (sendError) {
          const errorMsg = `Failed to send to ${subscriber.email}: ${sendError.message || JSON.stringify(sendError)}`;
          console.error(errorMsg);
          // Capture unique errors (avoid duplicating same error for each subscriber)
          if (!errors.some(e => e.includes(sendError.message || ''))) {
            errors.push(sendError.message || JSON.stringify(sendError));
          }
          totalFailed++;
        } else {
          console.log(`✅ Sent to ${subscriber.email}`);
          totalSent++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        const errorMsg = `Exception sending to ${subscriber.email}: ${error.message}`;
        console.error(errorMsg);
        if (!errors.some(e => e.includes(error.message || ''))) {
          errors.push(error.message || String(error));
        }
        totalFailed++;
      }
    }
  }

  console.log(`📧 Send complete: ${totalSent} sent, ${totalFailed} failed`);
  return { sent: totalSent, failed: totalFailed, errors, subscriberCount: subscribers.length };
}