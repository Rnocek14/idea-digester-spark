import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRecentPickVenues, recordPickedVenue } from "@/lib/recentVenuePersistence";
import { Link } from "react-router-dom";
import { PartyPopper } from "lucide-react";

type NightlifeEvent = {
  id: string;
  title: string;
  publish_date: string | null;
  original_url: string | null;
  metadata: { 
    verticals?: string[]; 
    content_tags?: string[]; 
    event_date?: string;
    recurring_days?: string[] | null; // e.g., ["friday", "saturday"]
  } | null;
  event_date: string | null;
  event_time: string | null;
  performer: string | null;
  created_at: string;
};

// Day name to number mapping for recurring_days
const DAY_NAME_TO_NUMBER: Record<string, number> = {
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
  'thursday': 4, 'friday': 5, 'saturday': 6
};

// Check if event matches a day using metadata.recurring_days (preferred) or title fallback
function eventMatchesDay(event: NightlifeEvent, dayOfWeek: number): boolean {
  const recurringDays = event.metadata?.recurring_days;
  
  // Use recurring_days from metadata if available
  if (recurringDays && Array.isArray(recurringDays) && recurringDays.length > 0) {
    return recurringDays.some(day => DAY_NAME_TO_NUMBER[day.toLowerCase()] === dayOfWeek);
  }
  
  // Fallback to title parsing for older events without metadata
  return matchesRecurringDay(event.title, dayOfWeek);
}

// Check if event is fresh enough to show (for undated events without recurring_days)
// Uses created_at (when ingested) rather than publish_date
function isFreshEvent(event: NightlifeEvent, maxDays: number = 14): boolean {
  if (!event.created_at) return false;
  const createdAt = new Date(event.created_at);
  const now = new Date();
  const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  // Default 14 days for music events - prevents undated content from lingering forever
  return daysDiff <= maxDays;
}

// Check if event is generic recurring (no specific days)
// STRICT: Only show undated events as "tonight" if title contains "tonight" or "today"
// This prevents multiple venue events from flooding the Tonight section
function isGenericRecurring(event: NightlifeEvent): boolean {
  const hasNightlifeVertical = event.metadata?.verticals?.includes('nightlife');
  if (!hasNightlifeVertical || !isFreshEvent(event, 14)) return false;
  
  // Require explicit "tonight" or "today" keywords in title
  const titleLower = event.title.toLowerCase();
  if (titleLower.includes('tonight') || titleLower.includes('today')) {
    return true;
  }
  
  // Also check for "live music" without a specific day name (generic daily events)
  // But only if title doesn't mention specific days
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const hasSpecificDay = dayNames.some(day => titleLower.includes(day));
  const hasLiveMusic = titleLower.includes('live music') && !hasSpecificDay;
  
  // For generic "live music" titles, only show if fresh (< 7 days)
  if (hasLiveMusic && isFreshEvent(event, 7)) {
    return true;
  }
  
  return false;
}

// Keywords that indicate garbage performer data
const GARBAGE_PERFORMER_KEYWORDS = [
  'http', 'ladies', 'penn', 'humor', 'wit', 'casino', 'cocktail', 
  'fish fry', 'carson hall', 'resort', 'pier', 'bar', 'tap house',
  'enjoy', 'live music', 'featuring', 'every', 'welcome', 'joyous',
  'wonderful', 'amazing', 'experience', '@', 'at the', 'lookout',
  // Sentence fragments / descriptions
  'the first', 'the second', 'the third', 'of each', 'during the',
  'such as', 'songs of', 'your meal', 'afternoon', 'evening',
  'contemporaries', 'menu', 'dinner', 'lunch', 'brunch',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'monday', 'tuesday'
];

// Patterns that indicate truncated sentences or garbage
const GARBAGE_PERFORMER_PATTERNS = [
  /…$/, // Ends with ellipsis
  /\.\.\.$/, // Ends with ...
  /\b(the|of|and|with|your|each|from|such|as|for|on|in|to)\s+(the|of|and|with|your|each|from|such|as|for|on|in|to)\b/i, // Multiple articles/prepositions
  /\b(enjoy|featuring|experience|welcome|menu|meal)\b/i, // Description words
  /^\d/, // Starts with number
  /[<>{}[\]]/, // Contains brackets
];

// Known venues for extraction and validation
const KNOWN_VENUES = [
  'Geneva Tap House', 'PIER 290', 'Mars Resort', 'The Lookout Bar', 'The Lookout',
  'Evolve', 'Baker House', 'Hogs & Kisses', 'Topsy Turvy', 'The Cat',
  'Maxwell Mansion', 'Abbey Resort', 'Lake Lawn Resort', 'Grand Geneva',
  'Pier 290', 'Lookout Bar', 'The Getaway', 'Harpoon Willies', "Harpoon Willie's"
];

// Venue name aliases for normalization
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
  // Pattern: "LIVE MUSIC AT THE LOOKOUT: PERFORMER" -> "The Lookout Bar"
  const atVenueMatch = title.match(/(?:@|at\s+(?:the\s+)?)([\w\s']+?)(?:\s*[:\-–]|$)/i);
  if (atVenueMatch) {
    const venue = atVenueMatch[1].trim();
    // Normalize and verify it's a known venue
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
  
  // Check for known venues in title and return normalized
  for (const venue of KNOWN_VENUES) {
    if (title.toLowerCase().includes(venue.toLowerCase())) {
      return normalizeVenueName(venue);
    }
  }
  
  // Handle "At [Venue] - Description" pattern
  const atDashMatch = title.match(/^At\s+([\w\s']+?)\s*[-–]/i);
  if (atDashMatch) {
    const venue = atDashMatch[1].trim();
    const normalized = normalizeVenueName(venue);
    if (normalized !== venue) return normalized;
    return venue;
  }
  
  // Handle show-style titles like "Christmas Show: Performer Name"
  // If no venue found but title has colon, return the show name part
  if (title.includes(':') && !title.toLowerCase().includes('live music')) {
    const showPart = title.split(':')[0].trim();
    if (showPart.length > 3 && showPart.length < 50) {
      return showPart;
    }
  }
  
  return '';
}

// Extract performer name from title like "LIVE MUSIC AT THE LOOKOUT: KEVIN KENNEDY"
// Also handles "Christmas Show: Frankie Seta LIVE as Dean Martin" -> "Frankie Seta"
function extractPerformerFromTitle(title: string): string | null {
  // Pattern: "VENUE: PERFORMER" or "LIVE MUSIC AT VENUE: PERFORMER"
  const colonMatch = title.match(/:\s*([^:]+?)\s*$/i);
  if (colonMatch) {
    let performer = colonMatch[1].trim();
    
    // Handle "Frankie Seta LIVE as Dean Martin" -> "Frankie Seta"
    const liveAsMatch = performer.match(/^(.+?)\s+LIVE\s+(?:as|performing|plays)/i);
    if (liveAsMatch) {
      performer = liveAsMatch[1].trim();
    }
    
    // Handle "Jeff Trudell" from "At Topsy Turvy - Live Music - Jeff Trudell"
    // If performer contains " - ", take the last part
    if (performer.includes(' - ')) {
      const parts = performer.split(' - ');
      performer = parts[parts.length - 1].trim();
    }
    
    if (isCleanPerformer(performer, title)) {
      return cleanPerformerName(performer);
    }
  }
  
  // Pattern: "At Venue - Live Music - Performer Name"
  const dashMatch = title.match(/[-–]\s*(?:Live Music\s*[-–]\s*)?([^-–]+?)\s*$/i);
  if (dashMatch) {
    const performer = dashMatch[1].trim();
    // Only use if it looks like a name (2-4 words, not venue-like)
    const wordCount = performer.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 4 && isCleanPerformer(performer, title)) {
      return cleanPerformerName(performer);
    }
  }
  
  return null;
}

// Clean performer name (proper casing, trimming)
function cleanPerformerName(name: string): string {
  if (!name) return name;
  // Title case the name
  return name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// Validate performer is actually a person/band name, not garbage
function isCleanPerformer(performer: string | null, title?: string): boolean {
  if (!performer) return false;
  const lower = performer.toLowerCase();
  
  // Too short or too long (40 is more realistic max for a performer name)
  if (performer.length < 2 || performer.length > 40) return false;
  
  // Contains garbage keywords
  if (GARBAGE_PERFORMER_KEYWORDS.some(kw => lower.includes(kw))) return false;
  
  // Matches garbage patterns (truncated sentences, etc.)
  if (GARBAGE_PERFORMER_PATTERNS.some(pattern => pattern.test(performer))) return false;
  
  // Is same as title (likely venue name repeated)
  if (title && lower === title.toLowerCase()) return false;
  
  // Starts with venue-like prefixes
  if (lower.startsWith('at ') || lower.startsWith('the ')) return false;
  
  // Contains too many words (likely a description, not a name)
  const wordCount = performer.trim().split(/\s+/).length;
  if (wordCount > 6) return false;
  
  return true;
}

// Get clean performer for display
function getDisplayPerformer(event: NightlifeEvent): string | null {
  // First try to extract from title (most reliable for our data)
  const fromTitle = extractPerformerFromTitle(event.title);
  if (fromTitle) return fromTitle;
  
  // Then try database performer if valid
  if (event.performer && isCleanPerformer(event.performer, event.title)) {
    return cleanPerformerName(event.performer);
  }
  
  return null;
}

// Check if performer should be displayed (avoid redundancy with what's shown)
// Compare against DISPLAYED venue name, not the full title
function shouldShowPerformer(displayedVenue: string, performer: string | null): boolean {
  if (!performer) return false;
  const venueLower = displayedVenue.toLowerCase();
  const performerLower = performer.toLowerCase();
  
  // If performer name is already in the displayed venue, don't repeat it
  if (venueLower.includes(performerLower)) return false;
  
  // Also check for partial matches (first name only)
  const performerFirst = performerLower.split(' ')[0];
  if (performerFirst.length > 3 && venueLower.includes(performerFirst)) return false;
  
  // Don't show if performer looks like a venue name
  if (KNOWN_VENUES.some(v => v.toLowerCase() === performerLower)) return false;
  
  return true;
}

// Filter to include all nightlife events (broadened from music-only)
function isValidNightlifeEvent(event: NightlifeEvent): boolean {
  const title = event.title.toLowerCase();
  
  // Hard exclude low-value or non-entertainment events
  const excludeTitleKeywords = [
    'penn & teller', 'penn and teller', 'wonderful!', 'magic show',
    'new year', 'happy new year', 'thank you for attending', 'casino',
    'skeptics', 'las vegas headliners', 'carson hall', 'thank you',
    'dance away winter blues', 'kids can dance', 'yoga', 'brunch'
  ];
  
  if (excludeTitleKeywords.some(kw => title.includes(kw))) return false;
  
  // For undated events, require freshness to prevent lingering forever
  if (!event.event_date && event.created_at) {
    const ageDays = (Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 14) return false;
  }
  
  // Accept all nightlife vertical events that pass the exclusion filter
  return true;
}

function getEventEmoji(title: string, tags?: string[]): string {
  const t = title.toLowerCase();
  const tagList = tags?.join(' ') || '';
  
  if (t.includes('dj') || tagList.includes('dj')) return '🎧';
  if (t.includes('jazz') || t.includes('blues')) return '🎷';
  if (t.includes('christmas') || t.includes('holiday')) return '🎄';
  if (t.includes('candlelight')) return '🕯️';
  if (t.includes('karaoke')) return '🎤';
  if (tagList.includes('late-night')) return '🌙';
  return '🎵';
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTodayDayOfWeek(): number {
  return new Date().getDay(); // 0 = Sunday, 6 = Saturday
}

function getUpcomingWeekendDates(): { saturday: string; sunday: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  if (daysUntilSaturday === 0 && now.getHours() >= 18) {
    daysUntilSaturday = 7;
  }
  
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  
  const formatDate = (d: Date) => 
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  return { saturday: formatDate(saturday), sunday: formatDate(sunday) };
}

// Get upcoming weekdays (Tuesday through Friday, excluding today and weekend)
function getUpcomingWeekdays(): { dayOfWeek: number; dayName: string; dateStr: string }[] {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const weekdays: { dayOfWeek: number; dayName: string; dateStr: string }[] = [];
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // On Saturday/Sunday, don't show weekdays (irrelevant)
  if (todayDayOfWeek === 0 || todayDayOfWeek === 6) {
    return [];
  }
  
  // Add remaining weekdays after today (up to Friday)
  for (let i = todayDayOfWeek + 1; i <= 5; i++) {
    const daysAhead = i - todayDayOfWeek;
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + daysAhead);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    weekdays.push({ dayOfWeek: i, dayName: dayNames[i], dateStr });
  }
  
  return weekdays;
}

// Check if a recurring event matches a specific day of week
// Day names: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
function matchesRecurringDay(title: string, targetDayOfWeek: number): boolean {
  const t = title.toLowerCase();
  const dayNames: Record<number, string[]> = {
    0: ['sunday', 'sun '],
    1: ['monday', 'mon '],
    2: ['tuesday', 'tue '],
    3: ['wednesday', 'wed '],
    4: ['thursday', 'thu '],
    5: ['friday', 'fri '],
    6: ['saturday', 'sat ']
  };
  
  const targetNames = dayNames[targetDayOfWeek] || [];
  return targetNames.some(name => t.includes(name));
}

function deduplicateByVenue(events: NightlifeEvent[], limit: number): NightlifeEvent[] {
  // Group events by normalized venue name
  const eventsByVenue = new Map<string, NightlifeEvent[]>();
  
  for (const event of events) {
    const venue = extractVenue(event.title);
    const normalizedVenue = normalizeVenueName(venue).toLowerCase();
    const key = normalizedVenue || event.id; // Use ID if no venue extracted
    if (!eventsByVenue.has(key)) {
      eventsByVenue.set(key, []);
    }
    eventsByVenue.get(key)!.push(event);
  }
  
  // For each venue, pick the event with most complete data
  const uniqueEvents: NightlifeEvent[] = [];
  for (const venueEvents of eventsByVenue.values()) {
    // Sort by data completeness: prefer events with performer AND time
    // Also consider if performer can be extracted from title
    const sorted = venueEvents.sort((a, b) => {
      const aPerformer = a.performer || extractPerformerFromTitle(a.title);
      const bPerformer = b.performer || extractPerformerFromTitle(b.title);
      const aScore = (aPerformer ? 3 : 0) + (a.performer ? 1 : 0) + (a.event_time ? 1 : 0);
      const bScore = (bPerformer ? 3 : 0) + (b.performer ? 1 : 0) + (b.event_time ? 1 : 0);
      return bScore - aScore; // Higher score = more complete = first
    });
    uniqueEvents.push(sorted[0]);
  }
  
  // Sort final list by event_time if available, then return limited
  return uniqueEvents
    .sort((a, b) => {
      // Prefer events with times, sort by time
      if (a.event_time && !b.event_time) return -1;
      if (!a.event_time && b.event_time) return 1;
      return 0;
    })
    .slice(0, limit);
}

interface NightlifeWidgetProps {
  tonightOnly?: boolean;
  showTonightsPick?: boolean;
  showLaterPick?: boolean; // Show "Pick of the Next 72 Hours" for TONIGHT column
  showModeToggle?: boolean; // Show Tonight | Weekend toggle
}

// Helper to format event date for display
function formatLaterPickDate(dateStr: string | null): string {
  if (!dateStr) return 'Soon';
  const eventDate = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (eventDate.toDateString() === today.toDateString()) return 'Today';
  if (eventDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return eventDate.toLocaleDateString('en-US', { weekday: 'long' });
}

// Calculate pick score for an event - higher is better
// Returns { score, reason } for "why this pick" label
function calculatePickScore(event: NightlifeEvent, recentVenues?: string[]): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const title = event.title.toLowerCase();
  
  // +3 if has performer (real performer field or extracted from title)
  const hasPerformer = event.performer || extractPerformerFromTitle(event.title);
  if (hasPerformer) {
    score += 3;
    reasons.push('confirmed performer');
  }
  
  // +2 if has event_time
  if (event.event_time) {
    score += 2;
    reasons.push('start time');
  }
  
  // +2 if has original_url (higher confidence)
  if (event.original_url) {
    score += 2;
  }
  
  // +2 if title has specific venue name (not just generic "live music")
  const hasSpecificVenue = KNOWN_VENUES.some(v => title.includes(v.toLowerCase()));
  if (hasSpecificVenue) {
    score += 2;
    reasons.push('known venue');
  }
  
  // -5 if title matches common low-value patterns
  const lowValuePatterns = [
    'live music at', 'live music every', 'featuring live', 
    'music every', 'live entertainment', 'every friday', 'every saturday'
  ];
  if (lowValuePatterns.some(p => title.includes(p) && !hasPerformer)) score -= 5;
  
  // -3 if title is too generic (no performer, no specific details)
  if (!hasPerformer && title.length < 30) score -= 3;
  
  // -3 if event_date is null (recurring without specific date)
  if (!event.event_date) score -= 3;
  
  // +1 for events with more complete metadata
  if (event.metadata?.content_tags?.length) score += 1;
  
  // Venue diversity penalty: -4 if this venue appeared recently
  if (recentVenues && recentVenues.length > 0) {
    const eventVenue = extractVenue(event.title).toLowerCase();
    if (eventVenue && recentVenues.includes(eventVenue)) {
      score -= 4;
    }
  }
  
  // Build reason string
  let reason = 'Upcoming event';
  if (reasons.length > 0) {
    reason = reasons.length === 1 
      ? `Has ${reasons[0]}` 
      : `Has ${reasons.slice(0, -1).join(', ')} + ${reasons[reasons.length - 1]}`;
  }
  
  return { score, reason };
}

// Mode for the toggle: tonight (default) or weekend
type ViewMode = 'tonight' | 'weekend';

export default function NightlifeWidget({ tonightOnly = false, showTonightsPick = false, showLaterPick = false, showModeToggle = false }: NightlifeWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tonight');
  const todayStr = getTodayDateString();
  const { saturday: saturdayStr, sunday: sundayStr } = getUpcomingWeekendDates();

  // Tonight's events - use event_date column with fallback to title keywords
  const { data: tonightEvents } = useQuery({
    queryKey: ["live-music-tonight", todayStr],
    queryFn: async () => {
      // First try events with event_date = today
      const { data: dateEvents, error: dateError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .eq("event_date", todayStr)
        .order("created_at", { ascending: false })
        .limit(10);

      if (dateError) {
        console.error("[NightlifeWidget] Error loading tonight events by date", dateError);
      }

      // Also fetch recurring events (no event_date) that might match today's day of week
      // Use higher limit to capture older recurring venue events that may have been created earlier
      const { data: recurringEvents, error: recurringError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (recurringError) {
        console.error("[LiveMusicWidget] Error loading recurring events", recurringError);
      }

      // Filter recurring events that match today's day of week
      const todayDayOfWeek = getTodayDayOfWeek();
      const matchingRecurring = (recurringEvents as NightlifeEvent[] || []).filter(e => {
        // Use metadata.recurring_days if available, fallback to title parsing
        return eventMatchesDay(e, todayDayOfWeek) || isGenericRecurring(e);
      });

      // Merge and deduplicate
      const allEvents = [...(dateEvents || []), ...matchingRecurring] as NightlifeEvent[];
      const seenIds = new Set<string>();
      const uniqueEvents = allEvents.filter(e => {
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      });

      // Filter to valid nightlife events
      const filtered = uniqueEvents.filter(isValidNightlifeEvent);
      return deduplicateByVenue(filtered, 5);
    },
    staleTime: 300000,
  });

  // Weekend events - use event_date column plus recurring events
  const { data: weekendEvents } = useQuery({
    queryKey: ["live-music-weekend", saturdayStr, sundayStr],
    queryFn: async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // Only fetch weekend events if it's not already the weekend
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { saturday: [], sunday: [] };
      }
      
      // Saturday events by event_date
      const { data: satEvents, error: satError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .eq("event_date", saturdayStr)
        .order("created_at", { ascending: false })
        .limit(5);

      if (satError) {
        console.error("[LiveMusicWidget] Error loading Saturday events", satError);
      }

      // Sunday events by event_date
      const { data: sunEvents, error: sunError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .eq("event_date", sundayStr)
        .order("created_at", { ascending: false })
        .limit(5);

      if (sunError) {
        console.error("[LiveMusicWidget] Error loading Sunday events", sunError);
      }

      // Also fetch recurring events (no event_date) to fill gaps
      const { data: recurringEvents } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .order("created_at", { ascending: false })
        .limit(30);

      // Filter recurring events by day of week using metadata.recurring_days or title fallback
      // NOTE: We do NOT use isGenericRecurring() here for weekend events
      // Generic recurring events only show in "Tonight" to prevent duplication across all sections
      const satRecurring: NightlifeEvent[] = [];
      const sunRecurring: NightlifeEvent[] = [];
      
      for (const event of (recurringEvents as NightlifeEvent[]) || []) {
        // Only include events that explicitly match the day (via recurring_days or title)
        // NOT generic "fresh nightlife" events which already show in Tonight
        if (eventMatchesDay(event, 6)) {
          satRecurring.push(event);
        }
        if (eventMatchesDay(event, 0)) {
          sunRecurring.push(event);
        }
      }

      // Merge dated events with recurring events
      const allSat = [...(satEvents as NightlifeEvent[] || []), ...satRecurring];
      const allSun = [...(sunEvents as NightlifeEvent[] || []), ...sunRecurring];

      // Deduplicate by ID
      const dedupeById = (events: NightlifeEvent[]): NightlifeEvent[] => {
        const seen = new Set<string>();
        return events.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      };

      const satFiltered = dedupeById(allSat).filter(isValidNightlifeEvent);
      const sunFiltered = dedupeById(allSun).filter(isValidNightlifeEvent);

      return {
        saturday: deduplicateByVenue(satFiltered, 4),
        sunday: deduplicateByVenue(sunFiltered, 4)
      };
    },
    staleTime: 300000,
  });

  // Weekday events (Tuesday through Friday, excluding today)
  const upcomingWeekdays = getUpcomingWeekdays();
  const weekdayDateStrings = upcomingWeekdays.map(w => w.dateStr);
  
  const { data: weekdayEvents } = useQuery({
    queryKey: ["live-music-weekdays", todayStr, weekdayDateStrings.join(',')],
    queryFn: async () => {
      if (upcomingWeekdays.length === 0) {
        return {};
      }

      // Fetch recurring events to find those matching upcoming weekdays
      const { data: recurringEvents, error: recurringError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (recurringError) {
        console.error("[LiveMusicWidget] Error loading recurring weekday events", recurringError);
      }

      // Also fetch one-off events with specific dates matching upcoming weekdays
      const { data: datedEvents, error: datedError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .in("event_date", weekdayDateStrings)
        .order("created_at", { ascending: false })
        .limit(30);

      if (datedError) {
        console.error("[LiveMusicWidget] Error loading dated weekday events", datedError);
      }

      // Group events by day of week
      const eventsByDay: Record<string, NightlifeEvent[]> = {};
      
      for (const weekday of upcomingWeekdays) {
        const matchingEvents: NightlifeEvent[] = [];
        
        // Add recurring events that match this day
        for (const event of (recurringEvents as NightlifeEvent[]) || []) {
          if (eventMatchesDay(event, weekday.dayOfWeek)) {
            matchingEvents.push(event);
          }
        }
        
        // Add one-off events with event_date matching this day
        for (const event of (datedEvents as NightlifeEvent[]) || []) {
          if (event.event_date === weekday.dateStr) {
            matchingEvents.push(event);
          }
        }
        
        // Deduplicate by ID
        const seenIds = new Set<string>();
        const uniqueEvents = matchingEvents.filter(e => {
          if (seenIds.has(e.id)) return false;
          seenIds.add(e.id);
          return true;
        });
        
        // Filter to valid nightlife events and deduplicate by venue
        const filtered = uniqueEvents.filter(isValidNightlifeEvent);
        const deduped = deduplicateByVenue(filtered, 3);
        
        if (deduped.length > 0) {
          eventsByDay[weekday.dayName] = deduped;
        }
      }
      
      return eventsByDay;
    },
    staleTime: 300000,
    enabled: upcomingWeekdays.length > 0,
  });

  // Pick of the Next 72 Hours - query for best upcoming event using scoring
  // Uses persisted recent venues for diversity penalty
  const { data: laterPickData } = useQuery({
    queryKey: ["later-pick-72h", todayStr],
    queryFn: async () => {
      const now = new Date();
      const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const nowStr = now.toISOString().split('T')[0];
      const in72HoursStr = in72Hours.toISOString().split('T')[0];
      
      // Get recently picked venues for diversity penalty
      const recentVenues = getRecentPickVenues();
      
      // Fetch multiple candidates and score them
      const { data: candidates, error } = await supabase
        .from("content_queue")
        .select("id, title, event_date, event_time, performer, original_url, metadata, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .gte("event_date", nowStr)
        .lte("event_date", in72HoursStr)
        .order("event_date", { ascending: true })
        .limit(15); // Increased to have more diversity candidates
      
      if (error || !candidates?.length) {
        console.error("[NightlifeWidget] Error loading 72h pick", error);
        return null;
      }
      
      // Score candidates with recent venue diversity penalty
      const scored = (candidates as NightlifeEvent[]).map(e => {
        const result = calculatePickScore(e, recentVenues);
        return {
          event: e,
          score: result.score,
          reason: result.reason
        };
      });
      
      // Sort by score (highest first), then by date (soonest first)
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // If same score, prefer soonest
        const aDate = a.event.event_date || '';
        const bDate = b.event.event_date || '';
        return aDate.localeCompare(bDate);
      });
      
      const best = scored[0];
      return best ? { event: best.event, reason: best.reason } : null;
    },
    staleTime: 300000,
    enabled: showLaterPick,
  });

  const laterPick = laterPickData?.event || null;
  const laterPickReason = laterPickData?.reason || null;

  // Record picked venue in useEffect to avoid duplicate recordings from React Query refetches
  const lastRecordedPickId = useRef<string | null>(null);
  useEffect(() => {
    if (laterPick && laterPick.id !== lastRecordedPickId.current) {
      const venue = extractVenue(laterPick.title);
      if (venue) {
        recordPickedVenue(venue);
        lastRecordedPickId.current = laterPick.id;
      }
    }
  }, [laterPick]);

  const hasTonight = tonightEvents && tonightEvents.length > 0;
  const hasWeekdays = !tonightOnly && weekdayEvents && Object.keys(weekdayEvents).length > 0;
  const hasWeekend = !tonightOnly && weekendEvents && (weekendEvents.saturday.length > 0 || weekendEvents.sunday.length > 0);
  const hasLaterPick = showLaterPick && laterPick;


  // For tonightOnly mode, show component even if tonight is empty (with "nothing scheduled" message)
  if (!tonightOnly && !hasLaterPick && !hasTonight && !hasWeekdays && !hasWeekend) return null;

  // Get Tonight's Pick - the "best" event for tonight (first one with a performer, or just first one)
  const tonightsPick = showTonightsPick && tonightEvents && tonightEvents.length > 0
    ? tonightEvents.find(e => e.performer || extractPerformerFromTitle(e.title)) || tonightEvents[0]
    : null;

  // Remaining tonight events (excluding Tonight's Pick if showing)
  const remainingTonightEvents = showTonightsPick && tonightsPick
    ? tonightEvents?.filter(e => e.id !== tonightsPick.id) || []
    : tonightEvents || [];

  // Determine if we should show weekend content based on toggle
  const showWeekendContent = viewMode === 'weekend' && hasWeekend;
  const showTonightContent = viewMode === 'tonight';

  return (
    <aside className="rounded-sm border border-slate-200 bg-white p-4">
      {/* Tonight | Weekend Toggle */}
      {showModeToggle && hasWeekend && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
          <button
            onClick={() => setViewMode('tonight')}
            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-sm ${
              viewMode === 'tonight' 
                ? 'bg-slate-900 text-white' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tonight
          </button>
          <button
            onClick={() => setViewMode('weekend')}
            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-sm ${
              viewMode === 'weekend' 
                ? 'bg-slate-900 text-white' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Weekend
          </button>
        </div>
      )}

      {/* Pick of the Next 72 Hours - Featured slot for TONIGHT column */}
      {hasLaterPick && showTonightContent && (
        <div className="mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-900">[PICK]</span>
            {laterPick?.event_date && (
              <span className="text-[10px] font-mono text-slate-400">{formatLaterPickDate(laterPick.event_date)}</span>
            )}
          </div>
          <div className="border-2 border-slate-900 rounded-sm p-3">
            {(() => {
              const venue = extractVenue(laterPick!.title);
              const displayName = venue || laterPick!.title;
              const displayPerformer = getDisplayPerformer(laterPick!);
              const showPerformer = shouldShowPerformer(displayName, displayPerformer);
              return (
                <>
                  {laterPick!.original_url ? (
                    <a 
                      href={laterPick!.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-900 leading-snug hover:text-slate-600 transition-colors block"
                    >
                      {displayName}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{displayName}</p>
                  )}
                  {showPerformer && displayPerformer && (
                    <p className="text-xs text-slate-600 mt-1">{displayPerformer}</p>
                  )}
                  {laterPick!.event_time && (
                    <p className="text-[10px] font-mono text-slate-400 mt-1">{laterPick!.event_time}</p>
                  )}
                  {laterPickReason && (
                    <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase">Why: {laterPickReason}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tonight's Pick - Featured slot at top (for tonightOnly mode) */}
      {tonightsPick && showTonightContent && (
        <div className="mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">⭐</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">Tonight's Pick</p>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-100">
            {(() => {
              const venue = extractVenue(tonightsPick.title);
              const displayName = venue || tonightsPick.title;
              const displayPerformer = getDisplayPerformer(tonightsPick);
              const showPerformer = shouldShowPerformer(displayName, displayPerformer);
              return (
                <>
                  {tonightsPick.original_url ? (
                    <a 
                      href={tonightsPick.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-foreground leading-snug hover:text-amber-700 transition-colors block"
                    >
                      {displayName}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-foreground leading-snug">{displayName}</p>
                  )}
                  {(showPerformer || tonightsPick.event_time) && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {showPerformer && displayPerformer}
                      {showPerformer && tonightsPick.event_time && ' · '}
                      {tonightsPick.event_time || 'Tonight'}
                    </p>
                  )}
                  {!showPerformer && !tonightsPick.event_time && (
                    <p className="text-[11px] text-muted-foreground mt-1">Tonight</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tonight Section - agenda style with mono times */}
      {showTonightContent && remainingTonightEvents.length > 0 ? (
        <>
          {!tonightsPick && (
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">[TONIGHT]</span>
            </div>
          )}
          
          <div className="space-y-1">
            {remainingTonightEvents.map((e) => {
              const venue = extractVenue(e.title);
              const displayName = venue || e.title;
              const displayPerformer = getDisplayPerformer(e);
              const showPerformer = shouldShowPerformer(displayName, displayPerformer);
              return (
                <div key={e.id} className="flex items-baseline gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[11px] font-mono text-slate-400 w-12 shrink-0">
                    {e.event_time || '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {e.original_url ? (
                      <a 
                        href={e.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-900 leading-snug hover:text-slate-600 transition-colors"
                        title={displayName}
                      >
                        {displayName}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-900 leading-snug">{displayName}</span>
                    )}
                    {showPerformer && displayPerformer && (
                      <span className="text-xs text-slate-500 ml-1">· {displayPerformer}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : showTonightContent && !hasLaterPick && remainingTonightEvents.length === 0 && !tonightsPick ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-1">Nothing scheduled tonight</p>
          <p className="text-[11px] text-muted-foreground/70 mb-3">Check back later or browse the full calendar</p>
          <Link 
            to="/lake-geneva?category=events" 
            className="text-xs text-primary hover:underline inline-block font-medium"
          >
            Browse full calendar →
          </Link>
        </div>
      ) : null}

      {/* This Week Section (Weekday events) - only in tonight mode */}
      {showTonightContent && hasWeekdays && (
        <div className={hasTonight ? "mt-4 pt-4 border-t border-slate-200" : ""}>
          <div className="mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">[THIS WEEK]</span>
          </div>

          {upcomingWeekdays.map(({ dayName }) => {
            const dayEvents = weekdayEvents![dayName];
            if (!dayEvents || dayEvents.length === 0) return null;
            
            return (
              <div key={dayName} className="mb-3">
                <p className="text-[10px] font-mono text-slate-400 mb-1 uppercase">{dayName}</p>
                <div className="space-y-1">
                  {dayEvents.map((e) => {
                    const venue = extractVenue(e.title);
                    const displayName = venue || e.title;
                    const displayPerformer = getDisplayPerformer(e);
                    const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                    return (
                      <div key={e.id} className="flex items-baseline gap-3 py-1 border-b border-slate-100 last:border-0">
                        <span className="text-[11px] font-mono text-slate-400 w-12 shrink-0">
                          {e.event_time || '—'}
                        </span>
                        <div className="flex-1 min-w-0">
                          {e.original_url ? (
                            <a 
                              href={e.original_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-slate-900 leading-snug hover:text-slate-600 transition-colors"
                              title={displayName}
                            >
                              {displayName}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-900 leading-snug">{displayName}</span>
                          )}
                          {showPerformer && displayPerformer && (
                            <span className="text-xs text-slate-500 ml-1">· {displayPerformer}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekend Section - show in tonight mode (below other content) OR exclusively in weekend mode */}
      {((showTonightContent && hasWeekend && !showModeToggle) || showWeekendContent) && (
        <div className={(showTonightContent && (hasTonight || hasWeekdays)) ? "mt-4 pt-4 border-t border-slate-200" : ""}>
          <div className="mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">[WEEKEND]</span>
          </div>

          {weekendEvents!.saturday.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-mono text-slate-400 mb-1 uppercase">Saturday</p>
              <div className="space-y-1">
                {weekendEvents!.saturday.map((e) => {
                  const venue = extractVenue(e.title);
                  const displayName = venue || e.title;
                  const displayPerformer = getDisplayPerformer(e);
                  const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                  return (
                    <div key={e.id} className="flex items-baseline gap-3 py-1 border-b border-slate-100 last:border-0">
                      <span className="text-[11px] font-mono text-slate-400 w-12 shrink-0">
                        {e.event_time || '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-900 leading-snug hover:text-slate-600 transition-colors"
                            title={displayName}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-900 leading-snug">{displayName}</span>
                        )}
                        {showPerformer && displayPerformer && (
                          <span className="text-xs text-slate-500 ml-1">· {displayPerformer}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {weekendEvents!.sunday.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-400 mb-1 uppercase">Sunday</p>
              <div className="space-y-1">
                {weekendEvents!.sunday.map((e) => {
                  const venue = extractVenue(e.title);
                  const displayName = venue || e.title;
                  const displayPerformer = getDisplayPerformer(e);
                  const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                  return (
                    <div key={e.id} className="flex items-baseline gap-3 py-1 border-b border-slate-100 last:border-0">
                      <span className="text-[11px] font-mono text-slate-400 w-12 shrink-0">
                        {e.event_time || '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-900 leading-snug hover:text-slate-600 transition-colors"
                            title={displayName}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-900 leading-snug">{displayName}</span>
                        )}
                        {showPerformer && displayPerformer && (
                          <span className="text-xs text-slate-500 ml-1">· {displayPerformer}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tonightOnly ? (
        <Link
          to="/nightlife"
          className="mt-3 block text-xs text-slate-600 hover:text-slate-900 transition-colors"
        >
          More happening tonight →
        </Link>
      ) : (
        <Link
          to="/lake-geneva?category=events"
          className="mt-3 block text-xs text-slate-600 hover:text-slate-900 transition-colors"
        >
          All events →
        </Link>
      )}
    </aside>
  );
}
