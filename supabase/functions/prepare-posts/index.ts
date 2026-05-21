import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Optimal posting time slots in Central Time (24-hour format)
// These are peak engagement hours for local news audiences
const OPTIMAL_SLOTS_CENTRAL = [8, 10, 12, 14, 16, 18]; // 8am, 10am, 12pm, 2pm, 4pm, 6pm

// Topic-specific civic image libraries for smart keyword mapping
type CivicTopic = 'land_use' | 'historic' | 'council' | 'parks' | 'lakefront' | 'library' | 'safety' | 'tourism' | 'utilities' | 'finance' | 'default';
type DiningTopic = 'fish_fry' | 'happy_hour' | 'brunch' | 'default';

const CIVIC_IMAGE_LIBRARIES: Record<CivicTopic, string[]> = {
  land_use: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
    "https://images.unsplash.com/photo-1486325212027-8a9ce835dc2e?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  ],
  historic: [
    "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800&q=80",
    "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
    "https://images.unsplash.com/photo-1594398028856-9b00722cefbc?w=800&q=80",
  ],
  council: [
    "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=80",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80",
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80",
  ],
  parks: [
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800&q=80",
  ],
  lakefront: [
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80",
    "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  ],
  library: [
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
  ],
  safety: [
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80",
    "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&q=80",
  ],
  tourism: [
    "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80",
    "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=800&q=80",
  ],
  utilities: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  ],
  finance: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  ],
  default: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lake_Geneva_Wisconsin_City_Hall.jpg/1280px-Lake_Geneva_Wisconsin_City_Hall.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Walworth_County_Courthouse.jpg/1280px-Walworth_County_Courthouse.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Lake_Geneva_Wisconsin_Riviera.jpg/1280px-Lake_Geneva_Wisconsin_Riviera.jpg",
  ],
};

const GENERIC_OG_PATTERNS = ["IconModuleCalendar", "calendar-icon", "default-event", "placeholder"];

// Known recurring venues — used to prevent the same venue (esp. for live music / specials)
// from monopolizing the X feed.
const KNOWN_VENUES = [
  'abbey resort', 'bar west', '240 west', 'geneva tap house', 'champs sports bar',
  'inspired coffee', 'next door pub', 'sopra bistro', 'gino\'s east',
  'baker house', 'pier 290', 'speedo\'s', 'studio winery', 'staller estate',
  'grand geneva', 'timber ridge', 'lake geneva country club', 'lake lawn resort',
  'sprecher', 'medusa grill', 'simple cafe', 'oakfire',
];

function extractVenue(title: string): string | null {
  const t = title.toLowerCase();
  for (const v of KNOWN_VENUES) {
    if (t.includes(v)) return v;
  }
  return null;
}

const SITE_BASE = 'https://lakegeneva.citybrief.info';
function getCanonicalLink(category: string | null | undefined): string {
  const c = (category || '').toLowerCase();
  if (c === 'nightlife') return `${SITE_BASE}/nightlife`;
  if (c === 'dining') return `${SITE_BASE}/eats`;
  if (c === 'incidents' || c === 'public_safety') return `${SITE_BASE}/incidents`;
  if (c === 'jobs') return `${SITE_BASE}/jobs`;
  if (c === 'deals') return `${SITE_BASE}/deals`;
  return SITE_BASE;
}

// Curated dining images for restaurant deals
const DINING_IMAGE_LIBRARIES: Record<DiningTopic, string[]> = {
  fish_fry: [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80",
  ],
  happy_hour: [
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80",
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80",
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80",
  ],
  brunch: [
    "https://images.unsplash.com/photo-1533920379810-6bed1ccd1228?w=800&q=80",
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
  ],
};

function detectDiningTopic(title: string, metadata: any): DiningTopic {
  const t = title.toLowerCase();
  const dealType = metadata?.deal_type?.toLowerCase() || '';
  
  if (dealType.includes('fish') || t.includes('fish fry') || t.includes('friday fish')) return 'fish_fry';
  if (dealType.includes('happy') || t.includes('happy hour')) return 'happy_hour';
  if (dealType.includes('brunch') || t.includes('brunch')) return 'brunch';
  
  return 'default';
}

function getCuratedDiningImage(storyId: string, title: string, metadata: any): string {
  const topic = detectDiningTopic(title, metadata);
  const images = DINING_IMAGE_LIBRARIES[topic] ?? DINING_IMAGE_LIBRARIES.default;
  const hash = storyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return images[hash % images.length];
}

function detectCivicTopic(title: string): CivicTopic {
  const t = title.toLowerCase();
  
  if (t.includes('hillmoor') || t.includes('development') || t.includes('rezoning') || t.includes('zoning') || 
      t.includes('subdivision') || t.includes('neighborhood plan') || t.includes('annexation') || 
      t.includes('redevelopment') || t.includes('plat') || t.includes('land use')) return 'land_use';
  if (t.includes('historic') || t.includes('preservation')) return 'historic';
  if (t.includes('common council') || t.includes('city council') || t.includes('council') || 
      t.includes('committee of the whole') || t.includes('governing body') || t.includes('board of aldermen')) return 'council';
  if (t.includes('park') || t.includes('cemetery') || t.includes('tree') || t.includes('avian')) return 'parks';
  if (t.includes('library')) return 'library';
  if (t.includes('police') || t.includes('fire') || t.includes('court') || t.includes('safety')) return 'safety';
  if (t.includes('tourism') || t.includes('visitor')) return 'tourism';
  if (t.includes('utility') || t.includes('utilities') || t.includes('water') || t.includes('sewer')) return 'utilities';
  if (t.includes('finance') || t.includes('licensing') || t.includes('regulation') || t.includes('budget')) return 'finance';
  if (t.includes('pier') || t.includes('harbor') || t.includes('harbour') || t.includes('lakefront')) return 'lakefront';
  
  return 'default';
}

function isGenericCivicImage(imageUrl: string | null): boolean {
  if (!imageUrl) return false;
  return GENERIC_OG_PATTERNS.some(pattern => imageUrl.toLowerCase().includes(pattern.toLowerCase()));
}

function getCuratedCivicImage(storyId: string, title: string): string {
  const topic = detectCivicTopic(title);
  const images = CIVIC_IMAGE_LIBRARIES[topic] ?? CIVIC_IMAGE_LIBRARIES.default;
  const pool = images.length > 0 ? images : CIVIC_IMAGE_LIBRARIES.default;
  
  const key = `${storyId}:${topic}`;
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return pool[hash % pool.length];
}

/**
 * Get the next available optimal posting slot for a platform.
 * Returns a Date in UTC that corresponds to an optimal Central Time slot.
 * Respects daily caps per platform.
 * 
 * Central Time is UTC-6 (CST) or UTC-5 (CDT during daylight saving).
 * December = CST = UTC-6
 */
function getNextOptimalSlot(
  platform: string, 
  usedSlots: Map<string, number>, // Map of "platform-YYYY-MM-DD" -> count of posts that day
  now: Date,
  maxPerDay: number
): Date | null {
  // Get current time in Central Time zone
  const centralFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const centralParts = centralFormatter.formatToParts(now);
  const centralYear = parseInt(centralParts.find(p => p.type === 'year')?.value || '2025');
  const centralMonth = parseInt(centralParts.find(p => p.type === 'month')?.value || '1') - 1;
  const centralDay = parseInt(centralParts.find(p => p.type === 'day')?.value || '1');
  const centralHour = parseInt(centralParts.find(p => p.type === 'hour')?.value || '0');
  const centralMinute = parseInt(centralParts.find(p => p.type === 'minute')?.value || '0');
  
  // Central Time offset from UTC (CST = -6, CDT = -5)
  const testDate = new Date(now);
  const utcHour = testDate.getUTCHours();
  const centralOffset = centralHour - utcHour + (centralDay !== testDate.getUTCDate() ? (centralDay > testDate.getUTCDate() ? 24 : -24) : 0);
  const utcOffset = -centralOffset; // Hours to ADD to Central to get UTC
  
  // Look up to 14 days ahead
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    // Calculate the date for this offset
    const checkDate = new Date(Date.UTC(centralYear, centralMonth, centralDay + dayOffset, 12, 0, 0));
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayKey = `${platform}-${dateStr}`;
    
    // Check if this day is already at capacity
    const currentDayCount = usedSlots.get(dayKey) || 0;
    if (currentDayCount >= maxPerDay) {
      continue; // Skip to next day
    }
    
    // Find which slots are available on this day
    const daySlotKey = `${platform}-${dateStr}-slots`;
    const usedHours = new Set<number>();
    
    // Check existing scheduled posts for this day
    for (const [key, _] of usedSlots.entries()) {
      if (key.startsWith(`${platform}-${dateStr}-`) && key !== dayKey) {
        const hour = parseInt(key.split('-').pop() || '0');
        usedHours.add(hour);
      }
    }
    
    for (const slotHour of OPTIMAL_SLOTS_CENTRAL) {
      // Skip slots that have already passed today
      if (dayOffset === 0) {
        if (slotHour < centralHour || (slotHour === centralHour && centralMinute > 0)) {
          continue;
        }
      }
      
      // Skip if this hour slot is already used
      const hourKey = `${platform}-${dateStr}-${slotHour}`;
      if (usedSlots.has(hourKey)) {
        continue;
      }
      
      // Found an available slot!
      usedSlots.set(hourKey, 1);
      usedSlots.set(dayKey, currentDayCount + 1);
      
      // Convert Central Time slot to UTC
      const utcHourForSlot = slotHour + utcOffset;
      
      // Handle day rollover
      let finalDay = centralDay + dayOffset;
      let finalHour = utcHourForSlot;
      if (finalHour >= 24) {
        finalHour -= 24;
        finalDay += 1;
      } else if (finalHour < 0) {
        finalHour += 24;
        finalDay -= 1;
      }
      
      const scheduledUTC = new Date(Date.UTC(centralYear, centralMonth, finalDay, finalHour, 0, 0));
      
      console.log(`[prepare-posts] ✅ Slot: ${platform} ${slotHour}:00 CT on ${dateStr} (day ${currentDayCount + 1}/${maxPerDay}) → UTC: ${scheduledUTC.toISOString()}`);
      return scheduledUTC;
    }
  }
  
  // No slots available in the next 14 days
  console.log(`[prepare-posts] ⚠️ No available slots for ${platform} in next 14 days (all at capacity)`);
  return null;
}

/**
 * Parse various raw event date formats into a Date object.
 * Handles: "January 28, 2026", "Fri, 30 Jan 2026 01:57:48 +0000", 
 * "2026-01-30T07:32", ISO strings, etc.
 */
function parseRawEventDate(raw: string): Date | null {
  try {
    // Try "Month Day" or "Month Day, Year" format
    const monthDayMatch = raw.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i);
    if (monthDayMatch) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.findIndex(m => m.startsWith(monthDayMatch[1].toLowerCase()));
      if (monthIndex >= 0) {
        const day = parseInt(monthDayMatch[2]);
        const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : new Date().getFullYear();
        return new Date(year, monthIndex, day);
      }
    }
    // Try direct parse (ISO, RFC2822, etc.)
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (_) { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[prepare-posts] Starting post preparation with OPTIMAL SCHEDULING...");

    // KILL SWITCH CHECK
    const { data: settings } = await supabaseClient
      .from("system_settings")
      .select("value")
      .eq("key", "automation")
      .single();
    
    const automationEnabled = (settings?.value as any)?.enabled !== false;
    const socialEnabled = (settings?.value as any)?.social_enabled !== false;
    
    if (!automationEnabled || !socialEnabled) {
      console.log("[prepare-posts] ⛔ Social automation is disabled via kill switch");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Social automation is disabled",
          automation_enabled: automationEnabled,
          social_enabled: socialEnabled
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[prepare-posts] ✅ Kill switch check passed");

    const now = new Date();
    
    // Pre-fetch existing scheduled posts to know which slots are taken
    // Map: "platform-YYYY-MM-DD" -> count, "platform-YYYY-MM-DD-HH" -> 1
    const usedSlotsByPlatform: Record<string, Map<string, number>> = {
      instagram: new Map(),
      facebook: new Map(),
      x: new Map(),
    };
    
    // Get all pending posts scheduled in the future
    const { data: existingPosts } = await supabaseClient
      .from("post_queue")
      .select("platform, scheduled_for")
      .eq("status", "pending")
      .gte("scheduled_for", now.toISOString());
    
    if (existingPosts) {
      for (const post of existingPosts) {
        const scheduledDate = new Date(post.scheduled_for);
        const centralTime = new Date(scheduledDate.toLocaleString("en-US", { timeZone: "America/Chicago" }));
        const dateStr = centralTime.toISOString().split('T')[0];
        const hour = centralTime.getHours();
        const dayKey = `${post.platform}-${dateStr}`;
        const hourKey = `${post.platform}-${dateStr}-${hour}`;
        
        const platformMap = usedSlotsByPlatform[post.platform];
        if (platformMap) {
          platformMap.set(hourKey, 1);
          platformMap.set(dayKey, (platformMap.get(dayKey) || 0) + 1);
        }
      }
    }
    console.log(`[prepare-posts] Pre-loaded ${existingPosts?.length || 0} existing scheduled posts`);

    // Fetch eligible content
    const since = new Date();
    since.setDate(since.getDate() - 2);

    const { data: eligibleStories, error: fetchError } = await supabaseClient
      .from("content_queue")
      .select("*")
      .in("status", ["approved", "auto_published", "published"])
      .eq("safety_level", "safe")
      .gte("created_at", since.toISOString())
      .not("content_facebook", "is", null)
      .not("content_instagram", "is", null)
      .not("content_x", "is", null)
      .order("is_breaking", { ascending: false })
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error("[prepare-posts] Error fetching stories:", fetchError);
      throw fetchError;
    }

    const breakingCount = eligibleStories?.filter(s => s.is_breaking).length || 0;
    console.log(`[prepare-posts] Found ${eligibleStories?.length || 0} eligible stories (${breakingCount} breaking)`);

    if (!eligibleStories || eligibleStories.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible stories found",
          prepared: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out stories with past event dates and stale holiday content
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    const isPostHoliday = currentMonth === 0 || (currentMonth === 11 && currentDay > 26);

    const freshStories = eligibleStories.filter(story => {
      // GEO GATE: only Lake Geneva / Walworth County content gets posted to social.
      // Block stories that are clearly tied to non-local Wisconsin places unless
      // the title/summary explicitly mentions a Lake Geneva anchor.
      const haystack = `${story.title || ''} ${story.summary || ''} ${story.geo_label || ''}`.toLowerCase();
      const LOCAL_ANCHORS = [
        'lake geneva', 'walworth', 'williams bay', 'fontana', 'delavan',
        'elkhorn', 'genoa city', 'lyons', 'linn', 'geneva lake',
        'abbey resort', 'grand geneva', 'pier 290', 'topsy turvy',
        'jackass saloon', 'bar west', 'geneva tap', 'the getaway',
        'foley', 'lake geneva billiards'
      ];
      const NON_LOCAL_FLAGS = [
        'milwaukee', 'madison', 'hartford', 'watertown', 'minocqua',
        'discovery world', 'green bay', 'kenosha', 'racine', 'waukesha',
        'appleton', 'oshkosh', 'eau claire', 'wausau', 'la crosse',
        'sheboygan', 'janesville', 'beloit'
      ];
      const hasLocal = LOCAL_ANCHORS.some(a => haystack.includes(a));
      const hasNonLocal = NON_LOCAL_FLAGS.some(a => haystack.includes(a));
      const geoTier = story.geo_tier ?? 0;
      const isLocalTier = geoTier === 1 || geoTier === 2;

      if (hasNonLocal && !hasLocal) {
        console.log(`[prepare-posts] ⏭️ GEO BLOCK (non-local mention): "${story.title.substring(0,60)}..."`);
        return false;
      }
      if (!isLocalTier && !hasLocal) {
        console.log(`[prepare-posts] ⏭️ GEO BLOCK (tier ${geoTier}, no local anchor): "${story.title.substring(0,60)}..."`);
        return false;
      }

      // PAST-DATE TEXT GATE: block if post_text-bound title references a past explicit date
      // (e.g. "starts March 26, 2026" while today is later in 2026)
      const explicitPast = haystack.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?/i);
      if (explicitPast) {
        const parsedExplicit = parseRawEventDate(explicitPast[0]);
        if (parsedExplicit && parsedExplicit < today) {
          console.log(`[prepare-posts] ⏭️ Skipping "${story.title.substring(0,60)}..." — explicit past date "${explicitPast[0]}"`);
          return false;
        }
      }

      // Check if event_date column has passed
      if (story.event_date) {
        const eventDate = new Date(story.event_date);
        eventDate.setHours(0, 0, 0, 0);
        if (eventDate < today) {
          console.log(`[prepare-posts] ⏭️ Skipping "${story.title.substring(0, 50)}..." - event_date ${story.event_date} has passed`);
          return false;
        }
      }

      // Also check raw_event_date in metadata (many events only have this)
      const rawEventDate = story.metadata?.raw_event_date;
      if (rawEventDate && !story.event_date) {
        const parsed = parseRawEventDate(rawEventDate);
        if (parsed && parsed < today) {
          console.log(`[prepare-posts] ⏭️ Skipping "${story.title.substring(0, 50)}..." - raw_event_date "${rawEventDate}" has passed`);
          return false;
        }
      }

      // Check title for past event signals (e.g. "Winterfest Jan 28 - Feb 1" when it's Feb 10)
      const titleDateMatch = story.title.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i);
      if (titleDateMatch && ['events', 'entertainment'].includes(story.category || '')) {
        const titleDate = parseRawEventDate(titleDateMatch[0]);
        if (titleDate && titleDate < today) {
          console.log(`[prepare-posts] ⏭️ Skipping "${story.title.substring(0, 50)}..." - title contains past date "${titleDateMatch[0]}"`);
          return false;
        }
      }

      // Skip Christmas/Santa/holiday content after Dec 26
      const isHolidayContent = /santa|christmas|holiday.*party|ugly.*sweater|new\s*year/i.test(story.title);
      if (isHolidayContent && isPostHoliday) {
        console.log(`[prepare-posts] ⏭️ Skipping holiday content after season: "${story.title.substring(0, 50)}..."`);
        return false;
      }

      return true;
    });

    console.log(`[prepare-posts] After freshness filter: ${freshStories.length} stories (filtered ${eligibleStories.length - freshStories.length} stale)`);

    if (freshStories.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No fresh stories found after filtering stale content",
          prepared: 0,
          total: eligibleStories.length,
          filtered: eligibleStories.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformConfig: Record<string, { maxPerDay: number }> = {
      instagram: { maxPerDay: 3 },
      facebook: { maxPerDay: 2 },
      x: { maxPerDay: 5 },
    };

    // Per-category daily caps on X to prevent any single category (esp. nightlife/dining)
    // from monopolizing the feed. News & civic are uncapped (within overall maxPerDay).
    const X_CATEGORY_DAILY_CAPS: Record<string, number> = {
      events: 2,
      entertainment: 2,
      dining: 1,
      nightlife: 1,
      sports: 2,
    };
    // Track scheduled counts: "x-YYYY-MM-DD-<category>" -> count
    const xCategoryCounts = new Map<string, number>();
    // Track venues already scheduled on X to avoid same-venue repetition: "<venue>" -> last scheduled date
    const xVenueScheduled = new Map<string, string>();

    // Pre-load category counts and venues from existing pending X posts
    if (existingPosts) {
      const { data: existingX } = await supabaseClient
        .from("post_queue")
        .select("scheduled_for, metadata")
        .eq("platform", "x")
        .eq("status", "pending")
        .gte("scheduled_for", now.toISOString());
      for (const p of existingX || []) {
        const d = new Date(p.scheduled_for).toISOString().split("T")[0];
        const cat = ((p.metadata as any)?.story_category || "").toLowerCase();
        if (cat) {
          const k = `x-${d}-${cat}`;
          xCategoryCounts.set(k, (xCategoryCounts.get(k) || 0) + 1);
        }
        const title = ((p.metadata as any)?.story_title || "").toLowerCase();
        const venue = extractVenue(title);
        if (venue) {
          const prev = xVenueScheduled.get(venue);
          if (!prev || d < prev) xVenueScheduled.set(venue, d);
        }
      }
    }

    let preparedCount = 0;
    let breakingPrepared = 0;
    let civicSkippedIG = 0;
    let curatedCivicUsed = 0;

    for (const story of freshStories) {
      const category = (story.category || '').toLowerCase();
      const isCivic = category === 'civic';
      const isDining = category === 'dining';
      
      // Determine image ONCE per story
      let finalImageUrl = story.image_url;
      let generatedImageUrl = null;
      let imageSource = 'og';
      const isSponsored = story.is_sponsored || false;
      
      const hasGenericCivicImage = isCivic && isGenericCivicImage(story.image_url);
      const isDiningWithCuratedImage = isDining && story.image_source === 'curated_dining';
      
      // Use curated dining image if it's a dining post without a good image
      if (isDining && (!story.image_url || story.image_source === 'curated_dining')) {
        finalImageUrl = getCuratedDiningImage(story.id, story.title, story.metadata);
        imageSource = 'curated_dining';
        console.log(`[prepare-posts] Using curated dining image for story ${story.id}`);
      } else if (hasGenericCivicImage) {
        const civicTopic = detectCivicTopic(story.title);
        finalImageUrl = getCuratedCivicImage(story.id, story.title);
        imageSource = 'curated_civic';
        curatedCivicUsed++;
        console.log(`[prepare-posts] Using curated civic image (${civicTopic}) for story ${story.id}`);
      } else if (isSponsored && !story.image_url) {
        console.log(`[prepare-posts] Sponsored story ${story.id} needs AI image`);
        
        try {
          const { data: aiImageData, error: aiError } = await supabaseClient.functions.invoke(
            'generate-post-image',
            { body: { story_id: story.id, platform: 'instagram' } }
          );

          if (aiError || !aiImageData?.image_url) {
            console.log(`[prepare-posts] BLOCKING sponsored story ${story.id} - AI generation failed`);
            continue;
          }
          
          generatedImageUrl = aiImageData.image_url;
          finalImageUrl = generatedImageUrl;
          imageSource = 'ai_sponsored';
        } catch (err) {
          console.error(`[prepare-posts] Exception generating AI image:`, err);
          continue;
        }
      } else if (isSponsored && story.image_url) {
        finalImageUrl = story.image_url;
        imageSource = 'existing_sponsored';
      } else if (story.image_source === 'AI') {
        imageSource = 'ai';
      }
      
      // Loop through platforms
      for (const [platform, config] of Object.entries(platformConfig)) {
        // Skip civic content on Instagram
        if (platform === 'instagram' && isCivic) {
          civicSkippedIG++;
          continue;
        }
        
        // Skip Instagram if no image
        if (platform === 'instagram' && !finalImageUrl) {
          continue;
        }

        // X-specific: venue-level dedup (no two posts about the same venue within 3 days)
        if (platform === 'x') {
          const venue = extractVenue(story.title);
          if (venue) {
            const prev = xVenueScheduled.get(venue);
            if (prev) {
              const prevDate = new Date(prev + 'T00:00:00Z');
              const daysSince = (now.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysSince < 3 && prev >= now.toISOString().split('T')[0]) {
                console.log(`[prepare-posts] ⚠️ VENUE DEDUP: skipping "${story.title.substring(0,40)}..." — ${venue} already scheduled ${prev}`);
                continue;
              }
            }
          }
        }
        
        // Check if already queued or sent for THIS story (prevent duplicates)
        const { data: existing } = await supabaseClient
          .from("post_queue")
          .select("id, status")
          .eq("story_id", story.id)
          .eq("platform", platform)
          .in("status", ["pending", "sent", "simulated"])
          .maybeSingle();

        if (existing) {
          console.log(`[prepare-posts] Skipping ${platform} for story ${story.id} - already ${existing.status}`);
          continue;
        }
        
        // CRITICAL: Check for SIMILAR content already posted recently to prevent duplicate tweets
        // This catches cases where multiple story_ids have the same/similar content (dedup failure upstream)
        const storyTitle = story.title.toLowerCase().trim();
        const titleWords = storyTitle.split(/\s+/).slice(0, 5).join(' '); // First 5 words for fuzzy match
        
        const recentCutoff = new Date();
        recentCutoff.setDate(recentCutoff.getDate() - 7); // Look back 7 days
        
        const { data: similarPosts } = await supabaseClient
          .from("post_queue")
          .select("id, post_text, story_id, sent_at")
          .eq("platform", platform)
          .in("status", ["sent", "simulated", "pending"])
          .gte("created_at", recentCutoff.toISOString())
          .limit(50);
        
        const hasSimilarPost = similarPosts?.some(p => {
          // Check if post text is very similar (contains same key phrases)
          const postLower = p.post_text.toLowerCase();
          // Match if the title keywords appear in the post
          return titleWords.length > 10 && postLower.includes(titleWords);
        });
        
        if (hasSimilarPost) {
          console.log(`[prepare-posts] ⚠️ DEDUP: Skipping ${platform} for "${story.title.substring(0, 40)}..." - similar content already posted`);
          continue;
        }


        const isBreaking = story.is_breaking || false;
        let scheduledFor: Date;
        
        if (isBreaking && platform === 'x') {
          // BREAKING NEWS: schedule immediately (within 2 minutes)
          scheduledFor = new Date(now.getTime() + 2 * 60 * 1000);
          console.log(`[prepare-posts] 🔴 BREAKING: Scheduling ${platform} post immediately`);
        } else {
          // Use optimal slot scheduling with daily cap
          // For X, find a slot that also respects per-category daily caps
          let chosenSlot: Date | null = null;
          const catKey = (story.category || '').toLowerCase();
          const catCap = platform === 'x' ? X_CATEGORY_DAILY_CAPS[catKey] : undefined;

          for (let attempt = 0; attempt < 14; attempt++) {
            const maybeScheduled = getNextOptimalSlot(platform, usedSlotsByPlatform[platform], now, config.maxPerDay);
            if (!maybeScheduled) break;
            if (platform === 'x' && catCap !== undefined) {
              const d = maybeScheduled.toISOString().split('T')[0];
              const k = `x-${d}-${catKey}`;
              const count = xCategoryCounts.get(k) || 0;
              if (count >= catCap) {
                console.log(`[prepare-posts] ⏭️ X category cap reached for ${catKey} on ${d} (${count}/${catCap}), trying next slot`);
                continue; // try a different day
              }
              xCategoryCounts.set(k, count + 1);
            }
            chosenSlot = maybeScheduled;
            break;
          }
          if (!chosenSlot) {
            console.log(`[prepare-posts] ⏭️ Skipping ${platform} for "${story.title.substring(0,40)}..." - no slot under category cap`);
            continue;
          }
          scheduledFor = chosenSlot;

          if (platform === 'x') {
            const venue = extractVenue(story.title);
            if (venue) xVenueScheduled.set(venue, scheduledFor.toISOString().split('T')[0]);
          }
        }

        const postText = story[`content_${platform}`];
        
        if (!postText) {
          continue;
        }

        // Append canonical link to drive traffic back to our site.
        // Each X post (and FB) should include a link to the relevant section.
        let finalPostText = postText;
        if (platform === 'x' || platform === 'facebook') {
          const link = getCanonicalLink(category);
          // Only append if the post doesn't already contain our domain
          if (!/citybrief\.info/i.test(finalPostText)) {
            if (platform === 'x') {
              // X counts any URL as 23 chars (t.co wrap). Reserve 24 (space + url).
              const RESERVED = 24;
              const MAX = 280;
              if (finalPostText.length + 1 + link.length > MAX) {
                const trimTo = MAX - RESERVED - 1; // 1 for trailing newline/space
                finalPostText = finalPostText.slice(0, trimTo - 1).trimEnd() + '…';
              }
              finalPostText = `${finalPostText}\n${link}`;
            } else {
              finalPostText = `${finalPostText}\n\n${link}`;
            }
          }
        }

        const { error: insertError } = await supabaseClient
          .from("post_queue")
          .insert({
            story_id: story.id,
            platform,
            post_text: finalPostText,
            image_url: finalImageUrl,
            generated_image_url: generatedImageUrl,
            is_sponsored: isSponsored,
            sponsor_id: story.sponsor_id || null,
            scheduled_for: scheduledFor.toISOString(),
            status: "pending",
            metadata: {
              story_title: story.title,
              story_category: story.category,
              image_source: imageSource,
              civic_topic: isCivic ? detectCivicTopic(story.title) : null,
              image_generated: generatedImageUrl ? true : false,
              sponsored_safe: isSponsored ? (generatedImageUrl ? true : false) : true,
              type: isBreaking ? 'breaking' : 'normal',
              priority_score: story.priority_score || 0,
              scheduling: 'optimal_slots',
            },
          });

        if (insertError) {
          console.error(`[prepare-posts] Error inserting post for ${platform}:`, insertError);
          continue;
        }

        const breakingLabel = isBreaking ? ' 🔴 BREAKING' : '';
        console.log(`[prepare-posts] ✅ Scheduled ${platform} post for ${scheduledFor.toISOString()} [${imageSource}]${breakingLabel}`);
        preparedCount++;
        if (isBreaking) breakingPrepared++;
      }
    }

    console.log(`[prepare-posts] Prepared ${preparedCount} posts with OPTIMAL SCHEDULING`);
    console.log(`[prepare-posts] Stats: ${breakingPrepared} breaking, ${civicSkippedIG} civic skipped on IG, ${curatedCivicUsed} curated civic images`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prepared ${preparedCount} posts with optimal scheduling${breakingPrepared > 0 ? ` (${breakingPrepared} breaking)` : ''}`,
        prepared: preparedCount,
        breakingPrepared,
        civicSkippedIG,
        curatedCivicUsed,
        storiesProcessed: eligibleStories.length,
        scheduling: 'optimal_slots',
        slots: OPTIMAL_SLOTS_CENTRAL.map(h => `${h}:00 CT`),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[prepare-posts] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
