import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  summary?: string;
  published?: string;
  updated?: string;
  "@_href"?: string;
  [key: string]: any;
}

interface SyncResult {
  success: boolean;
  sourcesProcessed: number;
  articlesInserted: number;
  skipped: number;
  errors: string[];
}

type AutoPublishRule = {
  id: string;
  source_id: string | null;
  category: string | null;
  action: "auto_publish" | "needs_review" | "flag";
  enabled: boolean;
};

// Normalize URL for deduplication (handles trailing slashes, encoding, case)
function normalizeUrl(url: string): string {
  try {
    return decodeURIComponent(url)
      .replace(/\/+$/, '')  // Remove trailing slashes
      .toLowerCase()
      .trim();
  } catch {
    return url.toLowerCase().trim();
  }
}

// Check if title indicates a recurring event (e.g., "Every Wednesday...")
function isRecurringEvent(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return lowerTitle.includes('every ') || 
         lowerTitle.includes('weekly ') ||
         lowerTitle.includes('daily ') ||
         lowerTitle.includes('monthly ');
}

// Extract recurring days of week from title/content (e.g., "Every Friday" → ["friday"])
function extractRecurringDays(title: string, content?: string): string[] | null {
  const text = `${title} ${content || ''}`.toLowerCase();
  
  // Check if this is actually a recurring event
  const isRecurring = text.includes('every ') || 
                      text.includes('weekly ') || 
                      text.includes('daily ') ||
                      text.includes('recurring');
  
  // Also check for day-of-week in title (common pattern for venue event listings)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const foundDays: string[] = [];
  
  for (const day of dayNames) {
    // Match patterns like "every friday", "fridays", "friday nights", "live music friday"
    const patterns = [
      new RegExp(`every\\s+${day}`, 'i'),
      new RegExp(`${day}s\\b`, 'i'), // plurals like "Fridays"
      new RegExp(`${day}\\s+night`, 'i'),
      new RegExp(`${day}\\s+live`, 'i'),
      new RegExp(`live\\s+music\\s+${day}`, 'i'),
    ];
    
    // If explicitly recurring, check for day mention
    if (isRecurring && text.includes(day)) {
      foundDays.push(day);
    } else {
      // Check specific patterns that imply recurring
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          foundDays.push(day);
          break;
        }
      }
    }
  }
  
  // Handle "daily" - all days
  if (text.includes('daily ') || text.includes('every day')) {
    return dayNames;
  }
  
  // Handle "weekends" or "weekend"
  if (text.includes('weekend') && foundDays.length === 0) {
    return ['friday', 'saturday', 'sunday'];
  }
  
  // Handle "weeknights" or "weekdays"
  if ((text.includes('weeknight') || text.includes('weekday')) && foundDays.length === 0) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }
  
  return foundDays.length > 0 ? [...new Set(foundDays)] : null;
}

// Get the next occurrence of a specific day of week (0=Sunday, 6=Saturday)
function getNextDayOfWeek(dayOfWeek: number): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7; // If it's already passed this week, get next week
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntil);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

// Parse event date from title/content patterns (recurring weekly events, specific dates)
function parseEventDate(title: string, content?: string): Date | null {
  const text = `${title} ${content || ''}`.toLowerCase();
  
  // Check for day-of-week patterns (recurring events)
  const dayPatterns: { pattern: RegExp; day: number }[] = [
    { pattern: /\b(every\s+)?sunday/i, day: 0 },
    { pattern: /\b(every\s+)?monday/i, day: 1 },
    { pattern: /\b(every\s+)?tuesday/i, day: 2 },
    { pattern: /\b(every\s+)?wednesday/i, day: 3 },
    { pattern: /\b(every\s+)?thursday/i, day: 4 },
    { pattern: /\b(every\s+)?friday/i, day: 5 },
    { pattern: /\b(every\s+)?saturday/i, day: 6 },
  ];
  
  for (const { pattern, day } of dayPatterns) {
    if (pattern.test(text)) {
      return getNextDayOfWeek(day);
    }
  }
  
  // Check for specific date patterns like "December 7, 2025" or "12/7/2025"
  const specificDateMatch = text.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (specificDateMatch) {
    const parsed = new Date(`${specificDateMatch[1]} ${specificDateMatch[2]}, ${specificDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  // Check for MM/DD/YYYY or M/D/YYYY
  const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDateMatch) {
    const parsed = new Date(`${slashDateMatch[1]}/${slashDateMatch[2]}/${slashDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

// Extract performer name from event title/content
function extractPerformer(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "Live Music: Artist Name" or "Live Music - Artist Name"
  const liveMusicMatch = text.match(/live\s+music[:\s-]+([^@\n\r]+?)(?:\s*[@\-–]|\s*$)/i);
  if (liveMusicMatch) {
    const performer = liveMusicMatch[1].trim();
    // Avoid returning generic text
    if (performer.length > 2 && performer.length < 80 && !performer.toLowerCase().includes('every')) {
      return performer;
    }
  }
  
  // Pattern: "featuring Artist Name" or "feat. Artist"
  const featMatch = text.match(/(?:featuring|feat\.?)\s+([^@\n\r,]+)/i);
  if (featMatch) {
    return featMatch[1].trim();
  }
  
  // Pattern: "with Artist Name" (at start or after venue)
  const withMatch = text.match(/\bwith\s+([A-Z][^@\n\r,]+?)(?:\s*[-–@]|\s*$)/i);
  if (withMatch) {
    const performer = withMatch[1].trim();
    if (performer.length > 2 && performer.length < 60) {
      return performer;
    }
  }
  
  // Pattern: Title is just the artist name (for venue-specific pages where title = performer)
  // Check if title looks like a name (2-4 words, capitalized)
  const words = title.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 5) {
    const allCapitalized = words.every(w => /^[A-Z]/.test(w) || /^(the|and|of|&)$/i.test(w));
    const looksLikeName = allCapitalized && !title.toLowerCase().includes('live music') && 
                          !title.toLowerCase().includes('event') && !title.toLowerCase().includes('special');
    if (looksLikeName) {
      return title.trim();
    }
  }
  
  return null;
}

// Extract event time from content
function extractEventTime(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`;
  
  // Pattern: "2:00 PM to 5:00 PM" or "2pm - 5pm" or "2:00 PM – 5:00 PM"
  const timeRangeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (timeRangeMatch) {
    return `${timeRangeMatch[1].toUpperCase().replace(/\s/g, '')} - ${timeRangeMatch[2].toUpperCase().replace(/\s/g, '')}`;
  }
  
  // Pattern: single time like "starts at 7pm" or "@ 8:00 PM"
  const singleTimeMatch = text.match(/(?:starts?\s+(?:at\s+)?|@\s*)(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (singleTimeMatch) {
    return singleTimeMatch[1].toUpperCase().replace(/\s/g, '');
  }
  
  // Pattern: "5:30 pm - 8:30 pm" (lowercase)
  const lowercaseRange = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i);
  if (lowercaseRange) {
    return `${lowercaseRange[1].toUpperCase().replace(/\s/g, '')} - ${lowercaseRange[2].toUpperCase().replace(/\s/g, '')}`;
  }
  
  return null;
}

// Parse flexible date formats (handles "December 17, 2025, 3:00 PM - 8:30 PM", "All Day", etc.)
function parseFlexibleDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // If already ISO format, return as-is
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    // Strip time range (take only start time before the dash)
    let cleanDate = dateStr.split(' - ')[0].trim();
    
    // Handle "All Day" - replace with noon
    if (cleanDate.toLowerCase().includes('all day')) {
      cleanDate = cleanDate.replace(/,?\s*All Day/i, ', 12:00 PM');
    }
    
    // Try to parse the cleaned date string
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    
    // Try parsing with just the date portion (no time)
    const dateOnlyMatch = dateStr.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
    if (dateOnlyMatch) {
      const dateOnly = new Date(dateOnlyMatch[1]);
      if (!isNaN(dateOnly.getTime())) {
        return dateOnly.toISOString();
      }
    }
  } catch (e) {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  
  // Fallback to current time
  return new Date().toISOString();
}

// Check if story is local to Lake Geneva coverage area (for regional sources)
function isLocalToCoverageArea(
  story: { title?: string; summary?: string; content?: string },
  coverageKeywords: string[]
): boolean {
  const text = `${story.title || ''} ${story.summary || ''} ${story.content || ''}`.toLowerCase();
  return coverageKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

// Default coverage keywords for Lake Geneva area
const DEFAULT_COVERAGE_KEYWORDS = [
  'lake geneva', 'walworth county', 'walworth', 'fontana', 'williams bay',
  'elkhorn', 'delavan', 'town of linn', 'highway 50', 'hwy 50', 'us-12',
  'big foot', 'badger high school', 'geneva lake', 'como', 'geneva',
  'lakewood', 'lyons', 'sugar creek', 'east troy', 'whitewater'
];

// Hyperlocal tier detection for geo-filtering
const HYPERLOCAL_TIER_1 = [
  'lake geneva', 'geneva lake', 'williams bay', 'fontana', 'downtown lake geneva'
];

const HYPERLOCAL_TIER_2 = [
  'walworth county', 'walworth', 'delavan', 'elkhorn', 'linn', 'bloomfield',
  'darien', 'east troy', 'como', 'big foot', 'badger high school'
];

type LocalityResult = { tier: 0 | 1 | 2; label: string | null };

function detectLocality(title: string, summary?: string | null): LocalityResult {
  const text = `${title} ${summary || ''}`.toLowerCase();

  for (const name of HYPERLOCAL_TIER_1) {
    if (text.includes(name.toLowerCase())) {
      return { tier: 1, label: 'Lake Geneva' };
    }
  }

  for (const name of HYPERLOCAL_TIER_2) {
    if (text.includes(name.toLowerCase())) {
      return { tier: 2, label: 'Walworth County' };
    }
  }

  return { tier: 0, label: null };
}

// Check if story is fresh enough to be breaking (within 24 hours)
function isFreshEnoughForBreaking(publishedAt: string | null): boolean {
  if (!publishedAt) return true; // Be lenient when missing
  try {
    const published = new Date(publishedAt);
    const now = new Date();
    const diffHours = (now.getTime() - published.getTime()) / (1000 * 60 * 60);
    return diffHours <= 24;
  } catch {
    return true; // Be lenient on parse errors
  }
}

// Classify breaking news based on keywords with smart severity detection
function classifyBreaking(story: {
  title?: string | null;
  summary?: string | null;
  category?: string | null;
  source_name?: string | null;
  published_at?: string | null;
}): { isBreaking: boolean; priorityScore: number } {
  // GUARD: Events should never be classified as breaking news or create incidents
  const category = (story.category || '').toLowerCase();
  if (category === 'events' || category === 'event' || category === 'community') {
    return { isBreaking: false, priorityScore: 0 };
  }
  
  const text = `${story.title || ''} ${story.summary || ''}`.toLowerCase();
  let score = 0;

  // Strong signals (+5) - truly severe language
  const strongKeywords = [
    'breaking', 'urgent', 'emergency', 'evacuate', 'shelter in place', 'amber alert',
    'active shooter', 'major accident', 'fatal', 'fatality', 'multiple injuries',
    'killed', 'dies', 'dead', 'death', 'child killed', 'children killed',
    'mass casualty', 'multiple fatalities', 'found dead', 'stabbed', 'shot'
  ];
  if (strongKeywords.some(k => text.includes(k))) {
    score += 5;
  }

  // Severe weather signals (+4)
  if (story.category === 'weather' || (story.source_name || '').toLowerCase().includes('nws')) {
    if (text.includes('severe thunderstorm') || text.includes('tornado') || 
        text.includes('blizzard') || text.includes('warning') || text.includes('flash flood')) {
      score += 4;
    }
  }

  // Public safety signals (+3)
  const publicSafetyKeywords = [
    'road closed', 'closure', 'crash', 'accident', 'fire', 'shooting',
    'police activity', 'missing person', 'water main break', 'power outage',
    'multi-vehicle', 'rollover', 'structure fire', 'house fire', 'barn fire',
    'road blocked', 'highway closed', 'detour', 'rescue', 'serious injury'
  ];
  if (publicSafetyKeywords.some(k => text.includes(k))) {
    score += 3;
  }

  // Combo bumps (+1) - certain combinations indicate severity
  if (text.includes('fire') && (text.includes('apartment') || text.includes('home') || text.includes('house'))) {
    score += 1;
  }
  if (text.includes('crash') && (text.includes('injur') || text.includes('hospital'))) {
    score += 1;
  }
  if (text.includes('shooting') && (text.includes('injur') || text.includes('victim'))) {
    score += 1;
  }

  // Time-sensitive signals (+2)
  const timeSensitiveKeywords = ['today', 'tonight', 'now', 'immediately', 'just happened', 'developing'];
  if (timeSensitiveKeywords.some(k => text.includes(k))) {
    score += 2;
  }

  // Threshold check + freshness guard
  const rawIsBreaking = score >= 4;
  const isBreaking = rawIsBreaking && isFreshEnoughForBreaking(story.published_at || null);
  
  return { isBreaking, priorityScore: score };
}

// Infer incident type from story content
type IncidentType = 'accident' | 'fire' | 'weather' | 'police' | 'utility' | 'other';

function inferIncidentType(story: {
  category?: string | null;
  title?: string | null;
  summary?: string | null;
}): IncidentType {
  const category = (story.category || '').toLowerCase();
  const text = `${story.title || ''} ${story.summary || ''}`.toLowerCase();

  if (category.includes('weather')) return 'weather';
  if (category.includes('traffic') || text.includes('crash') || text.includes('accident') || text.includes('collision')) {
    return 'accident';
  }
  if (text.includes('fire') || text.includes('structure fire') || text.includes('house fire')) {
    return 'fire';
  }
  if (text.includes('police') || text.includes('arrest') || text.includes('shooting')) {
    return 'police';
  }
  if (text.includes('power outage') || text.includes('utility') || text.includes('water main')) {
    return 'utility';
  }
  return 'other';
}

// Generate URL-friendly slug from title
function slugifyIncidentTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Link breaking story to an incident (find or create)
async function linkStoryToIncident(opts: {
  supabase: any;
  storyId: string;
  title: string;
  summary: string | null;
  category: string | null;
  priorityScore: number;
  source: string;
  sourceLabel: string;
}) {
  const { supabase, storyId, title, summary, category, priorityScore, source, sourceLabel } = opts;
  const type = inferIncidentType({ category, title, summary });

  // Try to find an existing active incident of the same type with similar title
  const titleWords = title.split(' ').slice(0, 4).join(' ');

  const { data: existingIncidents, error: findError } = await supabase
    .from('incidents')
    .select('*')
    .eq('incident_type', type)
    .in('status', ['active', 'monitoring'])
    .ilike('title', `%${titleWords}%`)
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
    const slug = baseSlug || `incident-${storyId}`;

    const { data: inserted, error: insertError } = await supabase
      .from('incidents')
      .insert({
        slug,
        title,
        incident_type: type,
        status: 'active',
        location: null,
        source_story_id: storyId,
        priority_score: priorityScore,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[incidents] Error creating new incident', insertError);
      return;
    }
    incident = inserted;
    console.log(`[incidents] Created new incident: ${title}`);
  } else {
    // Update existing incident's priority and timestamp
    const newPriority = Math.max(incident.priority_score || 0, priorityScore);
    await supabase
      .from('incidents')
      .update({
        priority_score: newPriority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incident.id);
    console.log(`[incidents] Linked to existing incident: ${incident.title}`);
  }

  // Add timeline update
  const updateText = summary || title;
  const { error: updateError } = await supabase
    .from('incident_updates')
    .insert({
      incident_id: incident.id,
      source,
      source_label: sourceLabel,
      text: updateText,
      is_verified: true,
      story_id: storyId,
    });

  if (updateError) {
    console.error('[incidents] Error inserting incident update', updateError);
  }

  return incident;
}

// Detect civic content based on keywords (city council, committees, municipal)
function isCivicContent(story: { title?: string | null; summary?: string | null; content?: string | null }): boolean {
  const text = `${story.title || ''} ${story.summary || ''} ${story.content || ''}`.toLowerCase();
  
  const civicKeywords = [
    'city council', 'common council', 'town board', 'village board', 'county board',
    'committee', 'commission', 'municipal', 'ordinance', 'resolution',
    'public hearing', 'city hall', 'town hall', 'village hall',
    'board of trustees', 'board meeting', 'alderman', 'aldermen', 'alderperson',
    'mayor', 'city administrator', 'city manager', 'village administrator',
    'zoning', 'planning commission', 'plan commission', 'historic preservation',
    'parks committee', 'finance committee', 'public works committee',
    'police commission', 'fire commission', 'library board',
    'school board', 'board of education', 'referendum',
    'tax levy', 'budget hearing', 'annual meeting', 'special meeting',
    'executive session', 'closed session', 'open session',
    'public comment', 'citizen comment', 'minutes approval',
    'city of lake geneva', 'town of linn', 'village of fontana', 'village of williams bay',
    'walworth county', 'walworth county board'
  ];
  
  return civicKeywords.some(keyword => text.includes(keyword));
}

function decideStatusForStory(
  rules: AutoPublishRule[] | null,
  sourceId: string,
  category: string | null,
  safetyLevel: string
): string {
  // SAFETY GATE: Check safety level FIRST before applying auto-publish rules
  // This ensures unsafe content never auto-publishes regardless of rules
  
  if (safetyLevel === "blocked") {
    // Never publish blocked content
    return "blocked";
  }
  
  if (safetyLevel === "sensitive") {
    // Sensitive content always requires manual review, regardless of auto-publish rules
    return "pending";
  }
  
  // Safety level is "safe" — proceed with auto-publish rule evaluation
  if (!rules || rules.length === 0) return "pending";
  
  const cat = category || null;
  
  // Most specific: exact source + category match
  const specific = rules.find(r => 
    r.enabled && 
    r.source_id === sourceId && 
    (r.category === cat || r.category === null)
  );
  
  // Global: any source + matching category
  const global = rules.find(r => 
    r.enabled && 
    r.source_id === null && 
    (r.category === cat || r.category === null)
  );
  
  const rule = specific || global;
  if (!rule) return "pending";
  
  switch (rule.action) {
    case "auto_publish": return "auto_published";
    case "flag": return "flagged";
    case "needs_review":
    default: return "pending";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load auto-publish rules
    const { data: rules, error: rulesError } = await supabase
      .from("auto_publish_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) {
      console.error("Failed to load auto_publish_rules:", rulesError);
    } else {
      console.log(`Loaded ${rules?.length || 0} active auto-publish rules`);
    }

    // Fetch active RSS and scrape sources
    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .in("type", ["rss", "scrape"]);

    if (sourcesError) throw sourcesError;

    const result: SyncResult = {
      success: true,
      sourcesProcessed: 0,
      articlesInserted: 0,
      skipped: 0,
      errors: [],
    };

    // Daily cap for events per source (prevents flood from high-volume event scrapers)
    const MAX_EVENTS_PER_SOURCE_PER_DAY = 15;
    const syncToday = new Date().toISOString().split('T')[0];

    // Process each source
    for (const source of sources || []) {
      result.sourcesProcessed++;

      try {
        console.log(`Processing ${source.type} source: ${source.name}`);
        
        // Pre-check daily event cap for this source if it's an events category
        const isEventSource = source.category === 'events' || source.name.toLowerCase().includes('event');
        let eventsInsertedToday = 0;
        let remainingEventSlots = MAX_EVENTS_PER_SOURCE_PER_DAY;
        
        if (isEventSource) {
          const { count } = await supabase
            .from("content_queue")
            .select("*", { count: "exact", head: true })
            .eq("source_id", source.id)
            .gte("created_at", `${syncToday}T00:00:00Z`)
            .lte("created_at", `${syncToday}T23:59:59Z`);
          
          eventsInsertedToday = count || 0;
          remainingEventSlots = Math.max(0, MAX_EVENTS_PER_SOURCE_PER_DAY - eventsInsertedToday);
          console.log(`📊 ${source.name}: ${eventsInsertedToday}/${MAX_EVENTS_PER_SOURCE_PER_DAY} events inserted today, ${remainingEventSlots} slots remaining`);
          
          if (remainingEventSlots <= 0) {
            console.log(`⏸️ Daily event cap reached for ${source.name}, skipping source entirely`);
            continue;
          }
        }
        let items: RSSItem[] = [];

        if (source.type === "rss") {
          // Fetch RSS feed
          const rssResponse = await fetch(source.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
            },
          });

          if (!rssResponse.ok) {
            throw new Error(`HTTP ${rssResponse.status}: ${rssResponse.statusText}`);
          }

          const xmlText = await rssResponse.text();

          // Parse RSS using fast-xml-parser
          const { XMLParser } = await import("https://esm.sh/fast-xml-parser@4.3.2");
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
          });

          const parsed = parser.parse(xmlText);
          const channel = parsed.rss?.channel || parsed.feed;

          if (!channel) {
            throw new Error("Invalid RSS format");
          }

          // Extract items (handle both RSS 2.0 and Atom)
          items = channel.item || channel.entry || [];
          if (!Array.isArray(items)) items = [items];

          console.log(`Found ${items.length} RSS items in ${source.name}`);
        } else if (source.type === "scrape") {
          // Fetch HTML page
          const htmlResponse = await fetch(source.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
            },
          });

          if (!htmlResponse.ok) {
            throw new Error(`HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`);
          }

          const htmlText = await htmlResponse.text();

          // Parse HTML using deno-dom
          const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
          const doc = new DOMParser().parseFromString(htmlText, "text/html");

          if (!doc) {
            throw new Error("Failed to parse HTML");
          }

          // Get selector from metadata with fallback logic
          let selector = source.metadata?.scrape_selector || ".event-item";
          
          // HARDCODED FIX: For Visit Lake Geneva Events, use correct selector
          if (source.name === "Visit Lake Geneva – Events" && selector === ".event-item") {
            console.log(`⚠️ Detected incorrect selector "${selector}" for ${source.name}, using fallback "article.slide"`);
            selector = "article.slide";
            
            // Auto-fix the database
            const updatedMetadata = { ...source.metadata, scrape_selector: "article.slide" };
            await supabase
              .from("sources")
              .update({ metadata: updatedMetadata })
              .eq("id", source.id);
            console.log(`✅ Updated ${source.name} selector in database to "article.slide"`);
          }

          console.log(`🔍 Using selector "${selector}" for ${source.name}`);
          const elements = doc.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector "${selector}" in ${source.name}`);

          // Get configurable selectors from metadata with fallbacks
          const titleSelector = source.metadata?.title_selector || "h2, h3, .title, .event-title";
          const linkSelector = source.metadata?.link_selector || "a";
          const dateSelector = source.metadata?.date_selector || "time, .date, .event-date";
          const descSelector = source.metadata?.desc_selector || "p, .description, .event-description";

          console.log(`🎯 Using extraction selectors - title: "${titleSelector}", link: "${linkSelector}"`);

          // Convert DOM elements to RSS-like items
          items = Array.from(elements).map((el, idx) => {
            const element = el as any; // Type assertion for deno-dom Element
            
            // For title selector, check if it's also a link (e.g., ".fsTitle a")
            const titleEl = element.querySelector(titleSelector);
            const linkEl = titleSelector === linkSelector 
              ? titleEl  // If title and link use same selector, reuse titleEl
              : element.querySelector(linkSelector);
            
            const dateEl = element.querySelector(dateSelector);
            const descEl = element.querySelector(descSelector);

            const title = titleEl?.textContent?.trim() || "";
            const link = linkEl?.getAttribute("href") || "";
            
            // Debug logging for first few items
            if (idx < 3) {
              console.log(`  Item ${idx + 1}: title="${title.substring(0, 50)}...", link="${link}"`);
            }

            return {
              title,
              link,
              pubDate: dateEl?.getAttribute("datetime") || dateEl?.textContent?.trim() || new Date().toISOString(),
              description: descEl?.textContent?.trim() || "",
            };
          }).filter(item => {
            const hasTitle = Boolean(item.title);
            const hasLink = Boolean(item.link);
            if (!hasTitle || !hasLink) {
              console.log(`  ⚠️ Filtered item - hasTitle: ${hasTitle}, hasLink: ${hasLink}`);
            }
            return hasTitle && hasLink;
          });

          console.log(`Extracted ${items.length} valid items from scraped content`);
        }

        // Check if this is a regional source that needs geo-filtering
        const isRegionalSource = source.metadata?.regional === true;
        const coverageKeywords = source.metadata?.coverage_keywords || DEFAULT_COVERAGE_KEYWORDS;

        // Process each item
        for (const item of items) {
          let originalUrl = item.link || item["@_href"] || "";
          const title = item.title || "";
          const rawContent = item.description || item.content || item.summary || "";
          const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();

          if (!originalUrl || !title) {
            result.skipped++;
            continue;
          }

          // For regional sources, filter to only local stories
          if (isRegionalSource) {
            if (!isLocalToCoverageArea({ title, summary: rawContent, content: rawContent }, coverageKeywords)) {
              console.log(`⏭️ Skipping non-local story from regional source: "${title.substring(0, 50)}..."`);
              result.skipped++;
              continue;
            }
            console.log(`✅ Local match from regional source: "${title.substring(0, 50)}..."`);
          }

          // Check for duplicates by normalized URL (handles trailing slashes, encoding)
          const normalizedUrl = normalizeUrl(originalUrl);
          const { data: existingUrls } = await supabase
            .from("content_queue")
            .select("id, original_url")
            .eq("source_id", source.id)
            .limit(500);

          const urlExists = existingUrls?.some(e => 
            normalizeUrl(e.original_url || '') === normalizedUrl
          );

          if (urlExists) {
            result.skipped++;
            continue;
          }

          // Check for recurring events - skip if same title + source already exists (regardless of date)
          if (isRecurringEvent(title)) {
            const { data: existingRecurring } = await supabase
              .from("content_queue")
              .select("id")
              .eq("source_id", source.id)
              .eq("title", title)
              .limit(1);

            if (existingRecurring?.length) {
              console.log(`⏭️ Skipping recurring event already in system: "${title.substring(0, 50)}..."`);
              result.skipped++;
              continue;
            }
          }

          // Check for duplicates by title + publish_date (same event different scrape)
          const parsedDate = parseFlexibleDate(pubDate);
          const publishDateOnly = parsedDate.split('T')[0]; // Just the date part
          
          const { data: existingByTitle } = await supabase
            .from("content_queue")
            .select("id")
            .eq("title", title)
            .eq("source_id", source.id)
            .gte("publish_date", `${publishDateOnly}T00:00:00Z`)
            .lte("publish_date", `${publishDateOnly}T23:59:59Z`)
            .maybeSingle();

          if (existingByTitle) {
            console.log(`Skipping duplicate: "${title}" on ${publishDateOnly}`);
            result.skipped++;
            continue;
          }

          // Try to extract OG image from the article page
          let imageUrl: string | null = null;
          let imageSource: string | null = null;

          try {
            // Convert relative URLs to absolute URLs for fetching AND storage
            if (originalUrl.startsWith('/')) {
              // Extract base URL from source URL
              const sourceUrlObj = new URL(source.url);
              const absoluteUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${originalUrl}`;
              console.log(`🔗 Converted relative URL for storage: ${originalUrl} → ${absoluteUrl}`);
              originalUrl = absoluteUrl; // Update originalUrl so absolute URL gets stored in DB
            }

            console.log(`🖼️ Attempting to extract image from: ${originalUrl}`);
            const pageResponse = await fetch(originalUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; LakeGenevaBot/1.0)",
              },
            });

            if (pageResponse.ok) {
              const pageHtml = await pageResponse.text();
              const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
              const pageDoc = new DOMParser().parseFromString(pageHtml, "text/html");

              if (pageDoc) {
                // Try og:image first (most common and reliable)
                const ogImage = pageDoc.querySelector('meta[property="og:image"]');
                if (ogImage) {
                  const content = ogImage.getAttribute("content");
                  if (content && content.length > 10 && !content.includes("1x1")) {
                    imageUrl = content;
                    imageSource = "source_og";
                    console.log(`✅ Found OG image: ${imageUrl.substring(0, 60)}...`);
                  }
                }

                // Fallback to twitter:image if og:image not found
                if (!imageUrl) {
                  const twitterImage = pageDoc.querySelector('meta[name="twitter:image"]');
                  if (twitterImage) {
                    const content = twitterImage.getAttribute("content");
                    if (content && content.length > 10 && !content.includes("1x1")) {
                      imageUrl = content;
                      imageSource = "source_og";
                      console.log(`✅ Found Twitter image: ${imageUrl.substring(0, 60)}...`);
                    }
                  }
                }
              }
            }
          } catch (imageError: any) {
            console.warn(`⚠️ Failed to extract image from ${originalUrl}: ${imageError.message}`);
            // Continue without image - not a fatal error
          }

          // Call OpenAI for summarization, categorization, and safety evaluation
          const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are a content normalizer and safety reviewer for a family-friendly Lake Geneva local media brand.

For each article, you must:
1. Write a clear, neutral, 2-3 sentence summary in a friendly local-news tone.
2. Assign a category: one of events, news, civic, community, dining, or real-estate. Use 'civic' for city council, committee meetings, municipal announcements, ordinances, public hearings, school board, and government-related content.
3. Assign content_tags (granular attributes): one or more tags like brunch, lunch, dinner, coffee, bar, cocktails, wine, brewery, live-music, dj, late-night, kids, family-friendly, meeting, ordinance, road-closure, school-board, open-house, market-update, etc.
4. Assign verticals (which accounts should show this): array from ["local", "eats", "nightlife", "civic", "family", "real_estate"]
   - Dining content: ["local", "eats"]
   - Bars/breweries/late-night/live-music: ["local", "nightlife"] or ["local", "eats", "nightlife"] for food+drink+music
   - City meetings, school board, road closures, public notices: ["local", "civic"]
   - Family events, kids activities: ["local", "family"]
   - Open houses, market updates: ["local", "real_estate"]
   - Most events also get "local" - it's the main feed
5. Evaluate safety and assign:
   - safety_level: safe, sensitive, or blocked
   - safety_tags: zero or more labels like crime, public-safety, politics, tragedy, dining, family, graphic-violence, sexual-content, hate, scam
   - safety_reason: a short sentence explaining why

Guidelines:
- SAFE: family-friendly events, dining, attractions, community info, basic weather/traffic, non-controversial business content
- SENSITIVE: crime, arrests, police logs, non-graphic accidents or fires, political campaigns or protests, obituaries and tragedies, contentious public issues
- BLOCKED: graphic violence, sexual content, hate/extremist content, obvious scams, or anything inappropriate for a general-audience local community brand

When in doubt between safe and sensitive, choose sensitive. Only use blocked for clearly inappropriate content.`
                },
                {
                  role: "user",
                  content: `Normalize this article:\n\nTitle: ${title}\nContent: ${rawContent.substring(0, 1000)}`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "normalize_article",
                  description: "Normalize article with summary, category, and safety evaluation",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "2-3 sentence summary in friendly local-news tone" },
                      category: { 
                        type: "string", 
                        enum: ["news", "events", "dining", "real-estate", "community", "civic"],
                        description: "Article category - use 'civic' for city council, committee meetings, municipal content"
                      },
                      content_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Granular content attributes like brunch, live-music, kids, meeting, road-closure"
                      },
                      verticals: {
                        type: "array",
                        items: { 
                          type: "string",
                          enum: ["local", "eats", "nightlife", "civic", "family", "real_estate"]
                        },
                        description: "Which account feeds should show this content"
                      },
                      safety_level: {
                        type: "string",
                        enum: ["safe", "sensitive", "blocked"],
                        description: "Safety evaluation level"
                      },
                      safety_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of safety labels"
                      },
                      safety_reason: {
                        type: "string",
                        description: "Short explanation of why this safety level was chosen"
                      }
                    },
                    required: ["summary", "category", "content_tags", "verticals", "safety_level", "safety_tags", "safety_reason"],
                    additionalProperties: false
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "normalize_article" } }
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI request failed: ${aiResponse.status}`);
            result.errors.push(`AI failed for: ${title.substring(0, 50)}`);
            continue;
          }

          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          const aiResult = toolCall ? JSON.parse(toolCall.function.arguments) : { 
            summary: rawContent.substring(0, 200), 
            category: "news",
            safety_level: "safe",
            safety_tags: [],
            safety_reason: "Fallback processing"
          };

          // Compute category and status based on safety + rules
          let aiCategory = aiResult.category || source.category || "news";
          
          // Override to civic category if civic keywords detected
          if (isCivicContent({ title, summary: aiResult.summary, content: rawContent })) {
            console.log(`🏛️ Detected civic content: "${title.substring(0, 40)}..." → overriding category to 'civic'`);
            aiCategory = "civic";
          }
          
          const safetyLevel = aiResult.safety_level || "safe";
          const status = decideStatusForStory(rules as AutoPublishRule[], source.id, aiCategory, safetyLevel);

          // Classify breaking news priority (with freshness check)
          const { isBreaking, priorityScore } = classifyBreaking({
            title,
            summary: aiResult.summary,
            category: aiCategory,
            source_name: source.name,
            published_at: parsedDate,
          });

          if (isBreaking) {
            console.log(`🔴 BREAKING: "${title.substring(0, 40)}..." (score: ${priorityScore})`);
          }
          
          // Detect locality tier for hyperlocal filtering
          const locality = detectLocality(title, aiResult.summary);
          // Use source default_geo_tier as fallback if no keywords matched
          const geoTier = locality.tier > 0 ? locality.tier : (source.default_geo_tier || 0);
          const geoLabel = locality.label || (source.default_geo_tier === 1 ? 'Lake Geneva' : source.default_geo_tier === 2 ? 'Walworth County' : null);
          
          console.log(`📋 Story "${title.substring(0, 40)}..." → category: ${aiCategory}, safety: ${safetyLevel}, status: ${status}, priority: ${priorityScore}, geo: tier${geoTier}`);

          // Parse actual event date, performer, and time for nightlife/events content
          const isNightlifeContent = aiResult.verticals?.includes('nightlife') || 
                                     aiCategory === 'events' ||
                                     source.metadata?.default_nightlife === true;
          let eventDate: string | null = null;
          let performer: string | null = null;
          let eventTime: string | null = null;
          
          if (isNightlifeContent) {
            const parsedEventDate = parseEventDate(title, rawContent);
            if (parsedEventDate) {
              eventDate = parsedEventDate.toISOString().split('T')[0]; // Just the date part (YYYY-MM-DD)
              console.log(`📅 Parsed event date for "${title.substring(0, 40)}...": ${eventDate}`);
            }
            
            // Extract performer and time
            performer = extractPerformer(title, rawContent);
            eventTime = extractEventTime(title, rawContent);
            
            if (performer) {
              console.log(`🎤 Extracted performer: "${performer}" for "${title.substring(0, 40)}..."`);
            }
            if (eventTime) {
              console.log(`⏰ Extracted time: "${eventTime}" for "${title.substring(0, 40)}..."`);
            }
          }

          // Insert into content_queue
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title: title,
              content: rawContent,
              summary: aiResult.summary || "",
              category: aiCategory,
              original_url: originalUrl,
              image_url: imageUrl,
              image_source: imageSource,
              publish_date: parseFlexibleDate(pubDate),
              event_date: eventDate,
              performer: performer,
              event_time: eventTime,
              status,
              safety_level: aiResult.safety_level || "safe",
              safety_tags: aiResult.safety_tags || [],
              safety_reason: aiResult.safety_reason || "",
              is_breaking: isBreaking,
              priority_score: priorityScore,
              geo_tier: geoTier,
              geo_label: geoLabel,
              metadata: {
                source_name: source.name,
                original_published_at: pubDate,
                raw_event_date: pubDate,
                event_date: eventDate,
                location_tags: source.metadata?.location_tags || ["Lake Geneva"],
                ai_model: "gpt-4o-mini",
                content_tags: aiResult.content_tags || [],
                verticals: aiResult.verticals || ["local"],
                recurring_days: isNightlifeContent ? extractRecurringDays(title, rawContent) : null,
              },
            });

          if (insertError) {
            console.error("Insert error:", insertError);
            result.errors.push(`Insert failed: ${title.substring(0, 50)}`);
          } else {
            result.articlesInserted++;
            
            // Track event insertions against daily cap
            if (isEventSource) {
              remainingEventSlots--;
              if (remainingEventSlots <= 0) {
                console.log(`📊 Daily event cap reached mid-sync for ${source.name}, stopping item processing`);
                break; // Exit the items loop for this source
              }
            }
            
            // Link breaking stories to incidents
            if (isBreaking) {
              // Get the inserted story ID
              const { data: insertedStory } = await supabase
                .from("content_queue")
                .select("id")
                .eq("original_url", originalUrl)
                .single();
              
              if (insertedStory) {
                const incident = await linkStoryToIncident({
                  supabase,
                  storyId: insertedStory.id,
                  title,
                  summary: aiResult.summary || null,
                  category: aiCategory,
                  priorityScore,
                  source: 'rss',
                  sourceLabel: source.name,
                });
                
                // Fire-and-forget Firecrawl enrichment for incident details
                if (incident && originalUrl) {
                  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
                  if (firecrawlApiKey) {
                    console.log(`[incidents] Triggering Firecrawl enrichment for incident ${incident.id}`);
                    // Background task: scrape article for location, severity, agencies
                    fetch(`${supabaseUrl}/functions/v1/scrape-incident-details`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        url: originalUrl,
                        title,
                        incident_id: incident.id,
                      }),
                    }).catch(err => console.error("[incidents] Firecrawl enrichment failed:", err));
                  }
                }
              }
            }
          }
        }

        // Update last_fetched_at
        await supabase
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);

      } catch (error: any) {
        console.error(`Error processing ${source.name}:`, error);
        result.errors.push(`${source.name}: ${error.message}`);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      actor_type: "system",
      entity_type: "source",
      action: "rss_sync",
      message: `RSS sync completed: ${result.articlesInserted} articles added, ${result.skipped} skipped`,
      details: result,
    });

    console.log("Sync result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        sourcesProcessed: 0,
        articlesInserted: 0,
        skipped: 0,
        errors: [error.message]
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
