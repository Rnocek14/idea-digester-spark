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
  skipsByReason: Record<string, number>;
  errors: string[];
}

// Skip event tracking for diagnostics
interface SkipEvent {
  source_id: string;
  source_name: string;
  reason: string;
  url?: string;
  title?: string;
  run_id: string;
}

type AutoPublishRule = {
  id: string;
  source_id: string | null;
  category: string | null;
  action: "auto_publish" | "needs_review" | "flag";
  enabled: boolean;
  requires_hyperlocal: boolean;
};

// URL patterns that indicate non-article pages (category listings, navigation, etc.)
const JUNK_URL_PATTERNS = [
  '/category/', '/tag/', '/page/', '/author/',
  '/categories/', '/tags/', '/archives/',
  'index.cfm', '/about', '/contact', '/privacy',
  '/terms', '/login', '/register', '/cart', '/checkout',
  '/wp-admin', '/wp-login', '/feed/', '/rss/',
  '/search', '/sitemap', '/404', '/error',
];

// Titles that indicate meta-pages, not articles
const BLOCKED_TITLES = [
  'home', 'about', 'contact', 'menu', 'categories', 'tags',
  'archive', 'search', 'login', 'register', 'privacy policy',
  'terms of service', 'posts categories', 'uncategorized',
  'more info', 'read more', 'click here', 'new boats',
];

// Titles containing these indicate non-local content (not Lake Geneva area)
const NON_LOCAL_TITLE_KEYWORDS = [
  'wisconsin dells', 'milwaukee weekend', 'chicago things to do',
  'madison events', 'green bay', 'appleton', 'oshkosh',
];

// AI hallucination phrases that indicate non-article content was processed
const HALLUCINATION_PHRASES = [
  'this article provides an overview',
  'readers to navigate',
  'enhance your experience',
  'rich tapestry of',
  'stay tuned for updates',
  'organize local content',
  'help organize',
  'making it easier to find',
  // Generic AI filler patterns
  'something for everyone',
  'popular destination known for',
  'stunning views and welcoming',
  'variety of attractions suitable',
  'whether you\'re looking for adventure or relaxation',
  'perfect for all ages',
];

// Check if URL is a valid HTTP/HTTPS URL (rejects tel:, mailto:, javascript:, urn:, etc.)
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Check if URL is a junk/non-article page
function isJunkUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return JUNK_URL_PATTERNS.some(pattern => path.includes(pattern));
  } catch {
    return JUNK_URL_PATTERNS.some(pattern => url.toLowerCase().includes(pattern));
  }
}

// Check if title indicates a meta-page or placeholder
function isBlockedTitle(title: string): boolean {
  const normalized = title.toLowerCase().trim();
  // Check against blocked list
  if (BLOCKED_TITLES.some(blocked => normalized.includes(blocked))) return true;
  // Too short
  if (normalized.length < 5) return true;
  // Single word titles like "About", "Home"
  if (/^[a-z]+$/.test(normalized)) return true;
  // "More Info" pattern (e.g., "Lake Geneva More Info")
  if (/^[a-z\s]+more info\s*$/i.test(normalized)) return true;
  return false;
}

// Check if title contains non-local destination (not Lake Geneva area)
function isNonLocalTitle(title: string): boolean {
  const lower = title.toLowerCase();
  // Skip if it mentions Lake Geneva (probably comparative article)
  if (lower.includes('lake geneva')) return false;
  return NON_LOCAL_TITLE_KEYWORDS.some(keyword => lower.includes(keyword));
}

// Check if AI summary contains hallucination patterns (sign of non-article content)
function isHallucinatedSummary(summary: string): boolean {
  const lower = summary.toLowerCase();
  return HALLUCINATION_PHRASES.some(phrase => lower.includes(phrase));
}

// Normalize URL for deduplication (handles trailing slashes, encoding, case, tracking params)
function normalizeUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const urlObj = new URL(decoded);
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
                           'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    
    // Normalize: lowercase host, remove trailing slash, keep remaining query params sorted
    urlObj.searchParams.sort();
    let normalized = urlObj.toString()
      .replace(/\/+$/, '')  // Remove trailing slashes
      .toLowerCase()
      .trim();
    
    // Remove empty query string
    if (normalized.endsWith('?')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  } catch {
    // Fallback for malformed URLs
    return url
      .replace(/\/+$/, '')
      .toLowerCase()
      .trim();
  }
}

// Extract URL core for fuzzy matching (strips all query params)
function getUrlCore(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.split('?')[0].replace(/\/+$/, '').toLowerCase();
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

// STRONG coverage keywords - must match at least one of these for regional sources
const STRONG_COVERAGE_KEYWORDS = [
  'lake geneva', 'walworth county', 'fontana', 'williams bay',
  'elkhorn', 'delavan', 'geneva lake', 'town of linn', 'big foot high school'
];

// WEAK coverage keywords - only valid if no exclusion cities present
const WEAK_COVERAGE_KEYWORDS = [
  'walworth', 'como', 'east troy', 'whitewater', 'lyons', 'sugar creek',
  'highway 50', 'hwy 50', 'us-12', 'lakewood', 'badger high school', 'geneva'
];

// Default coverage keywords for Lake Geneva area (combined for backward compat)
const DEFAULT_COVERAGE_KEYWORDS = [...STRONG_COVERAGE_KEYWORDS, ...WEAK_COVERAGE_KEYWORDS];

// NON-LOCAL CITY EXCLUSIONS - stories about these cities should not appear prominently
const NON_LOCAL_TITLE_CITIES = [
  'milwaukee', 'madison', 'chicago', 'racine', 'kenosha',
  'waukesha', 'green bay', 'appleton', 'oshkosh', 'janesville',
  'beloit', 'rockford', 'brookfield', 'wauwatosa', 'fond du lac'
];

// Check if story title prominently features a non-local city (should be excluded from feed)
function isNonLocalStory(title: string, summary?: string | null): boolean {
  const titleLower = (title || '').toLowerCase();
  const summaryLower = (summary || '').toLowerCase();
  const text = `${titleLower} ${summaryLower}`;
  
  // Check if a local keyword is present (takes priority)
  const hasLocalKeyword = STRONG_COVERAGE_KEYWORDS.some(k => text.includes(k));
  if (hasLocalKeyword) {
    return false; // Has local keyword, not non-local
  }
  
  // Check if a non-local city appears in the title (strong signal of non-local story)
  for (const city of NON_LOCAL_TITLE_CITIES) {
    if (titleLower.includes(city)) {
      return true; // City in title = definitely not local
    }
  }
  return false;
}

// Hyperlocal tier detection for geo-filtering
const HYPERLOCAL_TIER_1 = [
  'lake geneva', 'geneva lake', 'williams bay', 'fontana', 'downtown lake geneva',
  'riviera', 'big foot beach', 'nws milwaukee', 'sullivan wi'
];

// Tier-2: Walworth County area (15-25 min from Lake Geneva)
// Synced with backfill-geo-tiers edge function
const HYPERLOCAL_TIER_2 = [
  'walworth county', 'walworth', 'delavan', 'elkhorn', 'linn', 'bloomfield',
  'darien', 'east troy', 'como', 'lake como', 'big foot', 'badger high school',
  'genoa city', 'sharon', 'twin lakes', 'burlington', 'pell lake', 'lyons',
  'south central wisconsin'
];

// Categories that allow Tier-2 auto-publish (things locals would drive to)
const TIER2_ALLOWED_CATEGORIES = ['events', 'eats', 'nightlife', 'community', 'civic'];

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

// ============== DINING NEWS DETECTION ==============
// Keywords to detect restaurant openings, closings, reviews from news sources
const DINING_NEWS_KEYWORDS = {
  opening: ['now open', 'grand opening', 'opening soon', 'new restaurant', 'opens doors', 'set to open', 
            'announces opening', 'coming to', 'coming soon', 'new location', 'new eatery', 'new bar'],
  closing: ['closing', 'shutting down', 'last day', 'final day', 'closes permanently', 'closing its doors',
            'going out of business', 'farewell', 'says goodbye', 'end of an era'],
  review: ['review', 'best restaurants', 'top 10', 'must-try', 'hidden gem', 'where to eat', 
           'food critic', 'we tried', 'taste test', 'worth the trip', 'worth the hype'],
  deal: ['happy hour', 'fish fry', 'brunch special', 'taco tuesday', 'wing wednesday', 
         'kids eat free', 'early bird', 'late night menu', 'daily special'],
  chef: ['new chef', 'head chef', 'executive chef', 'culinary director', 'chef announces', 'chef leaves'],
  award: ['awarded', 'wins award', 'best of', 'award-winning', 'michelin', 'james beard', 'recognized'],
  menu: ['new menu', 'menu update', 'seasonal menu', 'menu change', 'revamped menu']
};

type DiningNewsCategory = 'opening' | 'closing' | 'review' | 'deal' | 'chef' | 'award' | 'menu' | null;

function detectDiningNewsCategory(title: string, content?: string): DiningNewsCategory {
  const text = `${title} ${content || ''}`.toLowerCase();
  
  // Check categories in order of importance
  for (const [category, keywords] of Object.entries(DINING_NEWS_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category as DiningNewsCategory;
    }
  }
  return null;
}

// Extract restaurant name from dining news
function extractRestaurantFromNews(title: string): string | null {
  // Common patterns: "Restaurant Name Now Open", "Restaurant Name Closing", etc.
  const patterns = [
    /^([A-Z][A-Za-z\s&']+?)\s+(?:now open|opens|opening|closing|closes|review|announces)/i,
    /(?:review:|trying|visit)\s+([A-Z][A-Za-z\s&']+?)(?:\s*[-–|:]|$)/i,
    /^([A-Z][A-Za-z\s&']+?)\s+(?:to open|set to|announces)/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1].trim().length > 3 && match[1].trim().length < 50) {
      return match[1].trim();
    }
  }
  return null;
}
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

// EXCLUSION PATTERNS - only block if these appear at START of title (not mid-story mentions)
const TITLE_START_EXCLUSIONS = [
  // Legal outcomes (headline-leading pattern)
  'sentenced', 'pleads guilty', 'convicted', 'found guilty', 'verdict',
  'man sentenced', 'woman sentenced', 'driver sentenced', 'suspect sentenced',
  
  // Historical/memorial (headline-leading)
  'community grieves', 'family mourns', 'memorial', 'in memoriam', 'obituary',
  'remembering', 'looking back', 'years ago', 'funeral for', 'tribute to'
];

// Patterns that should exclude anywhere in story (administrative/educational)
const FULL_TEXT_EXCLUSIONS = [
  // Policy/administrative news
  'expands support', 'new policy', 'policy change', 'announces plan',
  'study finds', 'study shows', 'study flags', 'report finds', 'analysis shows',
  'department announces', 'council approves', 'board approves',
  
  // Prevention/safety education
  'fire prevention', 'fire safety', 'safety tips', 'how to prevent',
  'awareness week', 'awareness month', 'training exercise', 'drill',
  'fire department hosts', 'fire department open house',
  
  // Department operations (not incidents)
  'new hire', 'retires', 'promoted', 'equipment purchase',
  'station renovation', 'open house', 'recruitment', 'staffing',
  'department expands', 'fire chief', 'police chief', 'department celebrates',
  
  // Events/entertainment (not incidents)
  'dj ', 'ladies night', 'live music', 'karaoke', 'trivia', 'concert',
  'festival', 'parade', 'fundraiser', 'gala', 'celebration'
];

// STRICT LOCALITY - areas that MUST be mentioned for incident creation
const INCIDENT_LOCAL_KEYWORDS = [
  // Tier 1: Core Lake Geneva
  'lake geneva', 'williams bay', 'fontana', 'geneva lake', 'town of linn',
  
  // Tier 2: Immediate Walworth County
  'walworth county', 'elkhorn', 'delavan', 'como', 'darien', 'whitewater',
  'east troy', 'lyons', 'bloomfield', 'sharon', 'walworth',
  
  // Local roads (incidents often mention roads)
  'highway 50', 'hwy 50', 'highway 12', 'hwy 12', 'us-12', 'us 12',
  'county road h', 'state road 67', 'highway 120', 'hwy 120',
  'county road o', 'county road b', 'highway 67', 'hwy 67'
];

// EXPLICITLY EXCLUDE non-local areas - only block if this is the PRIMARY location
const NON_LOCAL_AREAS = [
  'kenosha', 'racine', 'milwaukee', 'madison', 'waukesha',
  'janesville', 'beloit', 'chicago', 'rockford', 'green bay',
  'appleton', 'oshkosh', 'fond du lac', 'sheboygan', 'la crosse',
  'eau claire', 'wausau', 'superior', 'brookfield', 'wauwatosa'
];

// Check if story is local enough to create an incident
// trustedSource = true means the source only covers our area, so we trust it
function isLocalEnoughForIncident(
  story: { title?: string; summary?: string },
  trustedSource: boolean = false
): boolean {
  const text = `${story.title || ''} ${story.summary || ''}`.toLowerCase();
  
  // Check for local keywords first
  const hasLocalKeyword = INCIDENT_LOCAL_KEYWORDS.some(keyword => text.includes(keyword));
  
  // Check for non-local areas
  const hasNonLocalArea = NON_LOCAL_AREAS.some(area => text.includes(area));
  
  // If story explicitly mentions local area, allow it even if non-local areas mentioned
  // (e.g., "Kenosha woman arrested in Lake Geneva" should create incident)
  if (hasLocalKeyword) {
    return true;
  }
  
  // If from trusted local source (like TMJ4 Walworth, Walworth Sheriff), be lenient
  // Only reject if non-local area is prominent without any local mention
  if (trustedSource) {
    // Reject only if story prominently features non-local area (appears in first 50 chars of title)
    const titleStart = (story.title || '').toLowerCase().substring(0, 50);
    const nonLocalInTitle = NON_LOCAL_AREAS.some(area => titleStart.includes(area));
    if (nonLocalInTitle && !hasLocalKeyword) {
      return false;
    }
    return true; // Trust the source
  }
  
  // For non-trusted regional sources, require explicit local mention
  return false;
}

// Check if story matches exclusion patterns (false positive incidents)
function matchesExclusionPattern(title: string, fullText: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerText = fullText.toLowerCase();
  
  // Check title-start exclusions (only if pattern appears in first 30 chars of title)
  const titleStart = lowerTitle.substring(0, 30);
  if (TITLE_START_EXCLUSIONS.some(pattern => titleStart.includes(pattern))) {
    return true;
  }
  
  // Check full-text exclusions anywhere
  return FULL_TEXT_EXCLUSIONS.some(pattern => lowerText.includes(pattern));
}

// Classify breaking news based on keywords with smart severity detection
// trustedSource = true means source only covers our area (e.g., TMJ4 Walworth, Walworth Sheriff)
function classifyBreaking(story: {
  title?: string | null;
  summary?: string | null;
  category?: string | null;
  source_name?: string | null;
  published_at?: string | null;
}, trustedSource: boolean = false): { isBreaking: boolean; priorityScore: number } {
  // GUARD: Events should never be classified as breaking news or create incidents
  const category = (story.category || '').toLowerCase();
  if (category === 'events' || category === 'event' || category === 'community' || category === 'nightlife') {
    return { isBreaking: false, priorityScore: 0 };
  }
  
  const title = story.title || '';
  const text = `${title} ${story.summary || ''}`.toLowerCase();
  
  // EXCLUSION CHECK: Reject stories that match false-incident patterns
  if (matchesExclusionPattern(title, text)) {
    console.log(`[incidents] ⛔ Excluded by pattern: "${title.substring(0, 50)}..."`);
    return { isBreaking: false, priorityScore: 0 };
  }
  
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

  // Public safety signals (+3) - refined to avoid department news
  const publicSafetyKeywords = [
    'road closed', 'closure', 'crash', 'accident', 'shooting',
    'police activity', 'missing person', 'water main break', 'power outage',
    'multi-vehicle', 'rollover', 'structure fire', 'house fire', 'barn fire',
    'road blocked', 'highway closed', 'detour', 'rescue', 'serious injury'
  ];
  if (publicSafetyKeywords.some(k => text.includes(k))) {
    score += 3;
  }
  
  // Fire keyword - only count if it's an active fire, not department news
  if (text.includes('fire') && !text.includes('fire department') && !text.includes('fire chief') && 
      !text.includes('fire station') && !text.includes('fire prevention')) {
    // Look for action verbs that indicate active fire
    if (/fire\s+(breaks|broke|destroys|destroyed|damages|damaged|engulfs|engulfed|spreads|spreading|burns|burning)/i.test(text) ||
        text.includes('on fire') || text.includes('caught fire') || text.includes('fire at ')) {
      score += 3;
    }
  }

  // Combo bumps (+1) - certain combinations indicate severity
  if ((text.includes('apartment') || text.includes('home') || text.includes('house')) &&
      (text.includes('on fire') || text.includes('caught fire') || text.includes('structure fire'))) {
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
  const isFresh = isFreshEnoughForBreaking(story.published_at || null);
  
  // GEO-FILTER: Require local mention for incident creation (trustedSource = lenient filtering)
  const isLocal = isLocalEnoughForIncident({ 
    title: story.title || '', 
    summary: story.summary || '' 
  }, trustedSource);
  
  // Log when geo-filter or freshness blocks
  if (rawIsBreaking && isFresh && !isLocal) {
    console.log(`[incidents] ⛔ Geo-filtered: "${title.substring(0, 50)}..." - no local keywords found (trusted=${trustedSource})`);
  }
  if (rawIsBreaking && !isFresh) {
    console.log(`[incidents] ⛔ Stale story blocked: "${title.substring(0, 50)}..."`);
  }
  
  const isBreaking = rawIsBreaking && isFresh && isLocal;
  
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
  safetyLevel: string,
  geoTier: number = 0
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
  
  // HYPERLOCAL GATE: If rule requires hyperlocal, content must have geo_tier >= 1
  if (rule.requires_hyperlocal && geoTier < 1) {
    console.log(`⚠️ Rule requires hyperlocal but geo_tier=${geoTier}, keeping pending`);
    return "pending";
  }
  
  // TIER-2 CATEGORY GATE: Tier-2 can only auto-publish for specific categories
  // This prevents regional "news" from diluting the feed while allowing events/eats/nightlife
  // Only applies when the rule action is auto_publish (manual promotion still allowed)
  if (rule.action === "auto_publish" && geoTier === 2 && cat && !TIER2_ALLOWED_CATEGORIES.includes(cat)) {
    console.log(`⚠️ Tier-2 auto-publish blocked | category="${cat}" | source_id=${sourceId} | rule_id=${rule.id || 'unknown'}`);
    return "pending";
  }
  
  switch (rule.action) {
    case "auto_publish": 
      console.log(`✅ Auto-publishing | geo_tier=${geoTier} | category="${cat}" | source_id=${sourceId}`);
      return "auto_published";
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
    // Parse request body for optional parameters
    let sourceId: string | null = null;
    let sourceName: string | null = null;
    let limit: number | null = null;
    
    try {
      const body = await req.json();
      sourceId = body.source_id || null;
      sourceName = body.source_name || null;
      limit = body.limit || null;
    } catch {
      // No body or invalid JSON - that's fine, use defaults
    }

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

    // Build sources query with optional filters
    let sourcesQuery = supabase
      .from("sources")
      .select("*")
      .eq("status", "active")
      .in("type", ["rss", "scrape"]);
    
    // Single-source mode: filter by source_id or source_name
    if (sourceId) {
      console.log(`🎯 Single-source mode: fetching source_id=${sourceId}`);
      sourcesQuery = sourcesQuery.eq("id", sourceId);
    } else if (sourceName) {
      console.log(`🎯 Single-source mode: fetching source_name="${sourceName}"`);
      sourcesQuery = sourcesQuery.ilike("name", `%${sourceName}%`);
    } else {
      // Normal mode: order by last_fetched_at to prevent starvation
      sourcesQuery = sourcesQuery.order("last_fetched_at", { ascending: true, nullsFirst: true });
    }
    
    // Apply limit if specified
    if (limit && limit > 0) {
      console.log(`🔢 Limiting to ${limit} sources`);
      sourcesQuery = sourcesQuery.limit(limit);
    }

    const { data: sources, error: sourcesError } = await sourcesQuery;

    if (sourcesError) throw sourcesError;

    const result: SyncResult = {
      success: true,
      sourcesProcessed: 0,
      articlesInserted: 0,
      skipped: 0,
      skipsByReason: {},
      errors: [],
    };

    // Skip tracking for diagnostics
    const skips: SkipEvent[] = [];
    const runId = crypto.randomUUID();
    
    function recordSkip(
      source: { id: string; name: string },
      reason: string,
      opts: { url?: string; title?: string } = {}
    ) {
      skips.push({
        source_id: source.id,
        source_name: source.name,
        reason,
        url: opts.url?.substring(0, 500),
        title: opts.title?.substring(0, 200),
        run_id: runId,
      });
      result.skipsByReason[reason] = (result.skipsByReason[reason] || 0) + 1;
    }

    // Daily cap for events per source (prevents flood from high-volume event scrapers)
    const MAX_EVENTS_PER_SOURCE_PER_DAY = 15;
    const syncToday = new Date().toISOString().split('T')[0];

    // Helper to handle blocked source alarm
    async function handleSourceFailure(source: any, errorMessage: string) {
      const currentFailures = source.metadata?.consecutive_failures || 0;
      const newFailures = currentFailures + 1;
      const MAX_CONSECUTIVE_FAILURES = 3;
      
      console.log(`⚠️ Source "${source.name}" failure #${newFailures}: ${errorMessage}`);
      
      if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
        // ALARM: Disable source after repeated failures
        console.log(`🚨 BLOCKED-SOURCE ALARM: "${source.name}" disabled after ${newFailures} consecutive failures`);
        
        await supabase
          .from("sources")
          .update({ 
            status: "error",
            metadata: {
              ...source.metadata,
              consecutive_failures: newFailures,
              last_error: errorMessage,
              disabled_at: new Date().toISOString(),
              disabled_reason: `Auto-disabled after ${newFailures} consecutive fetch failures`
            }
          })
          .eq("id", source.id);
          
        return true; // Source was disabled
      } else {
        // Track failure but keep source active
        await supabase
          .from("sources")
          .update({ 
            metadata: {
              ...source.metadata,
              consecutive_failures: newFailures,
              last_error: errorMessage,
              last_error_at: new Date().toISOString()
            }
          })
          .eq("id", source.id);
          
        return false; // Source still active
      }
    }
    
    // Helper to reset failure count on success
    async function resetSourceFailures(source: any) {
      if (source.metadata?.consecutive_failures > 0) {
        console.log(`✅ Resetting failure count for "${source.name}"`);
        await supabase
          .from("sources")
          .update({ 
            metadata: {
              ...source.metadata,
              consecutive_failures: 0,
              last_error: null,
              last_error_at: null
            }
          })
          .eq("id", source.id);
      }
    }

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
          // Fetch RSS feed with full browser-like headers to avoid 403 blocks
          const rssResponse = await fetch(source.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/rss+xml, application/xml, text/xml, */*",
              "Accept-Language": "en-US,en;q=0.9",
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
          // DIY Scraping with anti-bot evasion and Firecrawl fallback
          const USER_AGENTS = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          ];
          
          let htmlText = '';
          let usedFirecrawl = false;
          
          // Try DIY fetch first with anti-bot headers
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) {
                await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
              }
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000);
              
              let referer = '';
              try { referer = new URL(source.url).origin; } catch {}
              
              const htmlResponse = await fetch(source.url, {
                headers: {
                  'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Accept-Encoding': 'gzip, deflate',
                  'Sec-Fetch-Dest': 'document',
                  'Sec-Fetch-Mode': 'navigate',
                  'Sec-Fetch-Site': 'none',
                  'Upgrade-Insecure-Requests': '1',
                  'Referer': referer,
                  'Cache-Control': 'no-cache',
                },
                redirect: 'follow',
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (htmlResponse.ok) {
                htmlText = await htmlResponse.text();
                if (htmlText.length >= 500) {
                  console.log(`✅ DIY fetch succeeded for ${source.name} (${htmlText.length} chars)`);
                  break;
                }
                console.log(`⚠️ Sparse content (${htmlText.length} chars), trying again...`);
              } else if (htmlResponse.status === 403 || htmlResponse.status === 429) {
                console.log(`⚠️ Got ${htmlResponse.status} for ${source.name}, will try Firecrawl`);
                break;
              }
            } catch (e) {
              console.log(`DIY fetch attempt ${attempt + 1} failed: ${e}`);
            }
          }
          
          // Firecrawl fallback if DIY failed
          const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
          if ((!htmlText || htmlText.length < 500) && firecrawlKey) {
            console.log(`🔥 Using Firecrawl fallback for ${source.name}`);
            try {
              const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${firecrawlKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: source.url,
                  formats: ['html'],
                  onlyMainContent: false,
                  waitFor: 3000,
                }),
              });
              
              if (fcRes.ok) {
                const data = await fcRes.json();
                htmlText = data.data?.html || '';
                usedFirecrawl = true;
                console.log(`✅ Firecrawl succeeded for ${source.name} (${htmlText.length} chars)`);
              } else {
                const errData = await fcRes.json().catch(() => ({}));
                console.log(`⚠️ Firecrawl failed: ${errData.error || fcRes.status}`);
              }
            } catch (err) {
              console.log(`⚠️ Firecrawl error: ${err}`);
            }
          }
          
          if (!htmlText || htmlText.length < 200) {
            throw new Error(`Failed to fetch content for ${source.name} - no HTML retrieved`);
          }

          // Parse HTML using deno-dom
          const { DOMParser } = await import("https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts");
          const doc = new DOMParser().parseFromString(htmlText, "text/html");

          if (!doc) {
            throw new Error("Failed to parse HTML");
          }

          // Get selector from metadata with fallback logic
          let selector = source.metadata?.scrape_selector || "article, .post, .news-item, .announcement";
          
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

          console.log(`🔍 Using selector "${selector}" for ${source.name} (firecrawl: ${usedFirecrawl})`);
          let elements = doc.querySelectorAll(selector);
          
          // Fallback: try common selectors if primary returns nothing
          if (elements.length === 0) {
            const fallbackSelectors = ['article', '.post', '.entry', '.news-item', '.announcement-item', 'li.item', '.card'];
            for (const fallback of fallbackSelectors) {
              elements = doc.querySelectorAll(fallback);
              if (elements.length > 0) {
                console.log(`🔄 Primary selector empty, using fallback "${fallback}" (found ${elements.length})`);
                break;
              }
            }
          }
          
          console.log(`Found ${elements.length} elements with selector "${selector}" in ${source.name}`);

          // Get configurable selectors from metadata with fallbacks
          const titleSelector = source.metadata?.title_selector || "h1, h2, h3, .title, .event-title, a";
          const linkSelector = source.metadata?.link_selector || "a";
          const dateSelector = source.metadata?.date_selector || "time, .date, .event-date, .published";
          const descSelector = source.metadata?.desc_selector || "p, .description, .excerpt, .summary";

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
            let link = linkEl?.getAttribute("href") || "";
            
            // Resolve relative URLs
            if (link && !link.startsWith('http')) {
              try {
                link = new URL(link, source.url).toString();
              } catch {}
            }
            
            // Debug logging for first few items
            if (idx < 3) {
              console.log(`  Item ${idx + 1}: title="${title.substring(0, 50)}...", link="${link.substring(0, 60)}..."`);
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
            recordSkip(source, 'missing_fields', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // HTTP-ONLY FILTER: Skip non-HTTP URLs (tel:, mailto:, javascript:, urn:, etc.)
          if (!isValidHttpUrl(originalUrl)) {
            console.log(`⏭️ Skipping non-HTTP URL: "${originalUrl.substring(0, 40)}..." - not a valid article URL`);
            recordSkip(source, 'invalid_url', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // JUNK URL FILTER: Skip category pages, tag pages, navigation pages
          if (isJunkUrl(originalUrl)) {
            console.log(`⏭️ Skipping junk URL: "${title.substring(0, 50)}..." - URL pattern blocked`);
            recordSkip(source, 'junk_url', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // BLOCKED TITLE FILTER: Skip meta-page titles like "Home", "About", "Categories"
          if (isBlockedTitle(title)) {
            console.log(`⏭️ Skipping blocked title: "${title}" - appears to be a meta-page`);
            recordSkip(source, 'blocked_title', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // NON-LOCAL DESTINATION FILTER: Skip articles about Wisconsin Dells, Milwaukee, etc.
          if (isNonLocalTitle(title)) {
            console.log(`⏭️ Skipping non-local destination: "${title.substring(0, 50)}..."`);
            recordSkip(source, 'nonlocal_destination', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // For regional sources, filter to only local stories
          if (isRegionalSource) {
            if (!isLocalToCoverageArea({ title, summary: rawContent, content: rawContent }, coverageKeywords)) {
              console.log(`⏭️ Skipping non-local story from regional source: "${title.substring(0, 50)}..."`);
              recordSkip(source, 'regional_nonlocal', { url: originalUrl, title });
              result.skipped++;
              continue;
            }
            console.log(`✅ Local match from regional source: "${title.substring(0, 50)}..."`);
          }

          // Check for duplicates by normalized URL (handles trailing slashes, encoding, tracking params)
          const normalizedUrl = normalizeUrl(originalUrl);
          const urlCore = getUrlCore(originalUrl);
          
          // CROSS-SOURCE URL DEDUPLICATION: Use URL core (no query params) for robust matching
          // Also check both http/https variants to catch protocol differences
          const urlCoreHttps = urlCore.replace(/^http:/, 'https:');
          const urlCoreHttp = urlCore.replace(/^https:/, 'http:');
          
          const { data: existingByUrlCore } = await supabase
            .from("content_queue")
            .select("id")
            .or(`original_url.ilike.${urlCore}%,original_url.ilike.${urlCoreHttps}%,original_url.ilike.${urlCoreHttp}%`)
            .limit(1);
          
          if (existingByUrlCore?.length) {
            console.log(`⏭️ Skipping duplicate URL (cross-source): "${title.substring(0, 50)}..." - URL already exists`);
            recordSkip(source, 'duplicate_url', { url: originalUrl, title });
            result.skipped++;
            continue;
          }

          // EVENTS TITLE DEDUPLICATION: For events category, skip if same title already exists from same source
          // This catches recurring events that don't have "every/weekly/daily" in the title
          // Visit Lake Geneva calendar gives each occurrence a unique URL, so URL dedup doesn't work
          const isEventCategory = source.category === 'events' || source.name.toLowerCase().includes('event');
          
          if (isEventCategory || isRecurringEvent(title)) {
            const { data: existingByTitleSource } = await supabase
              .from("content_queue")
              .select("id")
              .eq("source_id", source.id)
              .eq("title", title)
              .limit(1);

            if (existingByTitleSource?.length) {
              console.log(`⏭️ Skipping duplicate event (same title+source): "${title.substring(0, 50)}..."`);
              recordSkip(source, 'duplicate_event', { url: originalUrl, title });
              result.skipped++;
              continue;
            }
          }

          // Check for duplicates by title + publish_date (same event different scrape)
          const parsedDate = parseFlexibleDate(pubDate);
          const publishDateOnly = parsedDate.split('T')[0]; // Just the date part
          
          // CONTENT AGE GATE: Reject stories with publish_date older than 14 days OR in the future
          // Exception: recurring events (they represent ongoing schedules, not dated news)
          const publishedAtDate = new Date(parsedDate);
          const now = Date.now();
          const daysOld = (now - publishedAtDate.getTime()) / (1000 * 60 * 60 * 24);
          const daysInFuture = (publishedAtDate.getTime() - now) / (1000 * 60 * 60 * 24);
          const MAX_STORY_AGE_DAYS = 14;
          const MAX_FUTURE_DAYS = 1; // Allow up to 1 day in future for timezone issues
          
          // Handle future-dated content (like Fire Dept RSS with July 2025 dates)
          let adjustedPublishDate = parsedDate;
          if (daysInFuture > MAX_FUTURE_DAYS && !isRecurringEvent(title)) {
            console.log(`📅 Future-dated story (${Math.floor(daysInFuture)} days ahead): "${title.substring(0, 50)}..." - treating as today`);
            adjustedPublishDate = new Date().toISOString();
          }
          
          if (daysOld > MAX_STORY_AGE_DAYS && !isRecurringEvent(title)) {
            console.log(`⏭️ Skipping stale story (${Math.floor(daysOld)} days old): "${title.substring(0, 50)}..."`);
            recordSkip(source, 'stale_content', { url: originalUrl, title });
            result.skipped++;
            continue;
          }
          
          // CROSS-SOURCE TITLE DEDUPLICATION: Safe mode - only for news/community, not events/civic/weather
          // Avoids false positives on recurring events, meeting agendas, and weather alerts
          const trimmedTitle = title.trim();
          const sourceCategory = source.category?.toLowerCase() || '';
          const titleDedupCategories = ['news', 'community']; // Only apply title dedup for these
          const skipTitleDedupCategories = ['events', 'civic', 'weather', 'dining'];
          
          const shouldApplyTitleDedup = trimmedTitle.length >= 25 && 
            (titleDedupCategories.includes(sourceCategory) || isRegionalSource) &&
            !skipTitleDedupCategories.includes(sourceCategory);
          
          if (shouldApplyTitleDedup) {
            const { data: existingByExactTitle } = await supabase
              .from("content_queue")
              .select("id")
              .eq("title", trimmedTitle)
              .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Within last 48h
              .limit(1);
            
            if (existingByExactTitle?.length) {
              console.log(`⏭️ Skipping duplicate title (cross-source): "${title.substring(0, 50)}..."`);
              recordSkip(source, 'duplicate_title', { url: originalUrl, title });
              result.skipped++;
              continue;
            }
          }
          
          // SAME-SOURCE TITLE+DATE DEDUPLICATION: Check for same story from same source on same day
          const { data: existingBySourceTitleDate } = await supabase
            .from("content_queue")
            .select("id")
            .eq("title", title)
            .eq("source_id", source.id)
            .gte("publish_date", `${publishDateOnly}T00:00:00Z`)
            .lte("publish_date", `${publishDateOnly}T23:59:59Z`)
            .maybeSingle();

          if (existingBySourceTitleDate) {
            console.log(`Skipping duplicate: "${title}" on ${publishDateOnly}`);
            recordSkip(source, 'duplicate_source_date', { url: originalUrl, title });
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
                        description: "Article category - use 'civic' for city council, committee meetings, municipal content. Use 'dining' for restaurant news, openings, closings, reviews."
                      },
                      dining_sub_category: {
                        type: "string",
                        enum: ["opening", "closing", "review", "deal", "chef", "award", "menu", "general"],
                        description: "For dining articles: subcategory indicating type of restaurant news"
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

          // HALLUCINATION DETECTION: Check if AI produced filler content from non-article pages
          if (isHallucinatedSummary(aiResult.summary || '')) {
            console.log(`⚠️ Hallucination detected in summary: "${title}" - flagging for review`);
            aiResult.safety_level = 'sensitive';
            aiResult.safety_reason = 'AI-generated summary appears to be hallucinated from non-article content';
          }

          // Compute category and status based on safety + rules
          let aiCategory = aiResult.category || source.category || "news";
          
          // Override to civic category if civic keywords detected
          if (isCivicContent({ title, summary: aiResult.summary, content: rawContent })) {
            console.log(`🏛️ Detected civic content: "${title.substring(0, 40)}..." → overriding category to 'civic'`);
            aiCategory = "civic";
          }

          // Detect dining news subcategory
          let diningSubCategory: DiningNewsCategory = aiResult.dining_sub_category || null;
          if (aiCategory === 'dining' && !diningSubCategory) {
            // Fallback detection using keywords
            diningSubCategory = detectDiningNewsCategory(title, rawContent);
            if (diningSubCategory) {
              console.log(`🍽️ Detected dining news: "${title.substring(0, 40)}..." → ${diningSubCategory}`);
            }
          }
          
          // Extract restaurant name for dining news
          const diningRestaurantName = (aiCategory === 'dining') ? extractRestaurantFromNews(title) : null;
          
          const safetyLevel = aiResult.safety_level || "safe";
          
          // Detect locality tier for hyperlocal filtering BEFORE status decision
          const locality = detectLocality(title, aiResult.summary);
          
          // FIXED: Only use source default_geo_tier if source is hyperlocal (tier 1 or 2)
          // Regional sources (tier 0) should ONLY get elevated if keywords explicitly match
          // This prevents Milwaukee stories from regional sources getting tier 2
          let geoTier: number;
          let geoLabel: string | null;
          
          if (locality.tier > 0) {
            // Keyword match found - use detected tier
            geoTier = locality.tier;
            geoLabel = locality.label;
          } else if (isNonLocalStory(title, aiResult.summary)) {
            // Non-local city in title without local keywords - force tier 0
            geoTier = 0;
            geoLabel = null;
            console.log(`🚫 Non-local story detected, forcing tier 0: "${title.substring(0, 50)}..."`);
          } else if (source.default_geo_tier && source.default_geo_tier >= 1) {
            // Hyperlocal source (tier 1 or 2) - trust the source default
            geoTier = source.default_geo_tier;
            geoLabel = source.default_geo_tier === 1 ? 'Lake Geneva' : 'Walworth County';
          } else {
            // Regional source with no keyword match - stays tier 0
            geoTier = 0;
            geoLabel = null;
          }
          
          // Now decide status with geoTier for hyperlocal gate
          const status = decideStatusForStory(rules as AutoPublishRule[], source.id, aiCategory, safetyLevel, geoTier);

          // Classify breaking news priority (with freshness check)
          // Check if source is trusted for locality (e.g., TMJ4 Walworth, Walworth Sheriff)
          const trustedForLocality = source.metadata?.trust_locality === true;
          const { isBreaking, priorityScore } = classifyBreaking({
            title,
            summary: aiResult.summary,
            category: aiCategory,
            source_name: source.name,
            published_at: parsedDate,
          }, trustedForLocality);

          if (isBreaking) {
            console.log(`🔴 BREAKING: "${title.substring(0, 40)}..." (score: ${priorityScore})`);
          }
          
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
          const normalizedUrlValue = originalUrl ? normalizeUrl(originalUrl) : null;
          const { error: insertError } = await supabase
            .from("content_queue")
            .insert({
              source_id: source.id,
              title: title,
              content: rawContent,
              summary: aiResult.summary || "",
              category: aiCategory,
              original_url: originalUrl,
              normalized_url: normalizedUrlValue,
              image_url: imageUrl,
              image_source: imageSource,
              publish_date: adjustedPublishDate,
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
                dining_sub_category: diningSubCategory,
                dining_restaurant_name: diningRestaurantName,
              },
            });

          if (insertError) {
            console.error("Insert error:", insertError);
            result.errors.push(`Insert failed: ${title.substring(0, 50)}`);
          } else {
            result.articlesInserted++;
            
            // Log dining news to restaurant_news table for tracking openings/closings
            if (aiCategory === 'dining' && diningSubCategory && ['opening', 'closing', 'chef', 'award'].includes(diningSubCategory)) {
              // Try to find matching restaurant by name
              let restaurantId: string | null = null;
              if (diningRestaurantName) {
                const { data: matchedRestaurant } = await supabase
                  .from("restaurants")
                  .select("id")
                  .ilike("name", `%${diningRestaurantName}%`)
                  .limit(1)
                  .maybeSingle();
                restaurantId = matchedRestaurant?.id || null;
              }
              
              await supabase.from("restaurant_news").insert({
                restaurant_id: restaurantId,
                news_type: diningSubCategory,
                headline: title,
                summary: aiResult.summary,
                source_url: originalUrl,
                source_name: source.name,
                published_at: adjustedPublishDate,
              }).then(({ error }) => {
                if (!error) {
                  console.log(`📰 Logged restaurant news: ${diningSubCategory} - "${title.substring(0, 40)}..."`);
                }
              });
            }
            
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

        // Update last_fetched_at and reset failure count on success
        await supabase
          .from("sources")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", source.id);
        
        // Reset consecutive failures on successful sync
        await resetSourceFailures(source);

      } catch (error: any) {
        console.error(`Error processing ${source.name}:`, error);
        result.errors.push(`${source.name}: ${error.message}`);
        
        // Track failure and potentially disable source
        const wasDisabled = await handleSourceFailure(source, error.message);
        if (wasDisabled) {
          result.errors.push(`⚠️ ${source.name} has been auto-disabled after repeated failures`);
        }
      }
    }

    // Batch insert skip events for diagnostics (max 500 per batch to avoid payload limits)
    if (skips.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < skips.length; i += batchSize) {
        const batch = skips.slice(i, i + batchSize);
        const { error: skipError } = await supabase.from("sync_skips").insert(batch);
        if (skipError) {
          console.warn(`⚠️ Failed to insert skip batch: ${skipError.message}`);
        }
      }
      console.log(`📊 Recorded ${skips.length} skip events`);
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
