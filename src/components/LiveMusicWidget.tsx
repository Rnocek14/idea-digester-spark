import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Music } from "lucide-react";

type MusicEvent = {
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
function eventMatchesDay(event: MusicEvent, dayOfWeek: number): boolean {
  const recurringDays = event.metadata?.recurring_days;
  
  // Use recurring_days from metadata if available
  if (recurringDays && Array.isArray(recurringDays) && recurringDays.length > 0) {
    return recurringDays.some(day => DAY_NAME_TO_NUMBER[day.toLowerCase()] === dayOfWeek);
  }
  
  // Fallback to title parsing for older events without metadata
  return matchesRecurringDay(event.title, dayOfWeek);
}

// Check if event is fresh enough to show (for undated events without recurring_days)
function isFreshEvent(event: MusicEvent): boolean {
  // If published within last 24 hours, consider it fresh/relevant
  if (!event.publish_date) return false;
  const publishDate = new Date(event.publish_date);
  const now = new Date();
  const hoursDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}

// Check if event is generic recurring (no specific days)
// CHANGED: No longer treats undated events as "show every day"
// Now requires either: recurring_days set, title mentions day, or freshly published
function isGenericRecurring(event: MusicEvent): boolean {
  const recurringDays = event.metadata?.recurring_days;
  
  // If has recurring_days, it's NOT generic - it's day-specific
  if (recurringDays && Array.isArray(recurringDays) && recurringDays.length > 0) {
    return false;
  }
  
  // Check if title mentions specific days - if so, NOT generic
  const t = event.title.toLowerCase();
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (allDays.some(day => t.includes(day))) {
    return false;
  }
  
  // For events without recurring_days and no day in title:
  // Only show if freshly published (within 24 hours)
  // This prevents old one-off events from showing indefinitely
  return isFreshEvent(event);
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
function getDisplayPerformer(event: MusicEvent): string | null {
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

// Filter to only include actual live music events with useful info
function isLiveMusicEvent(event: MusicEvent): boolean {
  const title = event.title.toLowerCase();
  
  // Hard exclude non-music events by title
  const excludeTitleKeywords = [
    'ladies night', 'trivia', 'comedy', 'penn & teller', 'penn and teller',
    'bingo', 'game night', 'wine tasting', 'wine night', 'paint night',
    'yoga', 'brunch', 'wonderful!', 'magic show', 'poker', 'fish fry',
    'new year', 'happy new year', 'thank you for attending', 'casino',
    'skeptics', 'las vegas headliners', 'carson hall', 'thank you'
  ];
  
  if (excludeTitleKeywords.some(kw => title.includes(kw))) return false;
  
  // Must have "live music" in title, OR "music mondays/tuesdays/etc" pattern, OR have a clean performer
  const hasLiveMusic = title.includes('live music') || title.includes('live:');
  const hasMusicDayPattern = /music (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(title);
  const hasCleanPerformer = getDisplayPerformer(event) !== null;
  
  if (!hasLiveMusic && !hasMusicDayPattern && !hasCleanPerformer) return false;
  
  // Require at least performer OR specific time to be worth showing
  const displayPerformer = getDisplayPerformer(event);
  const hasSpecificTime = event.event_time && 
    !event.event_time.toLowerCase().includes('all day') &&
    event.event_time.trim().length > 0;
  
  // Must have at least one useful detail (performer or time)
  if (!displayPerformer && !hasSpecificTime) return false;
  
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
function getUpcomingWeekdays(): { dayOfWeek: number; dayName: string }[] {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const weekdays: { dayOfWeek: number; dayName: string }[] = [];
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // On Saturday/Sunday, don't show weekdays (irrelevant)
  if (todayDayOfWeek === 0 || todayDayOfWeek === 6) {
    return [];
  }
  
  // Add remaining weekdays after today (up to Friday)
  for (let i = todayDayOfWeek + 1; i <= 5; i++) {
    weekdays.push({ dayOfWeek: i, dayName: dayNames[i] });
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

function deduplicateByVenue(events: MusicEvent[], limit: number): MusicEvent[] {
  // Group events by normalized venue name
  const eventsByVenue = new Map<string, MusicEvent[]>();
  
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
  const uniqueEvents: MusicEvent[] = [];
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

export default function LiveMusicWidget() {
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
        console.error("[LiveMusicWidget] Error loading tonight events by date", dateError);
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
      const matchingRecurring = (recurringEvents as MusicEvent[] || []).filter(e => {
        // Use metadata.recurring_days if available, fallback to title parsing
        return eventMatchesDay(e, todayDayOfWeek) || isGenericRecurring(e);
      });

      // Merge and deduplicate
      const allEvents = [...(dateEvents || []), ...matchingRecurring] as MusicEvent[];
      const seenIds = new Set<string>();
      const uniqueEvents = allEvents.filter(e => {
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      });

      // Filter to only actual live music events
      const musicOnly = uniqueEvents.filter(isLiveMusicEvent);
      return deduplicateByVenue(musicOnly, 5);
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
      const satRecurring: MusicEvent[] = [];
      const sunRecurring: MusicEvent[] = [];
      
      for (const event of (recurringEvents as MusicEvent[]) || []) {
        // Check for Saturday (day 6)
        if (eventMatchesDay(event, 6)) {
          satRecurring.push(event);
        }
        // Check for Sunday (day 0)
        if (eventMatchesDay(event, 0)) {
          sunRecurring.push(event);
        }
        // Generic recurring events (no specific days) - show on both weekend days
        if (isGenericRecurring(event)) {
          if (!satRecurring.includes(event)) satRecurring.push(event);
          if (!sunRecurring.includes(event)) sunRecurring.push(event);
        }
      }

      // Merge dated events with recurring events
      const allSat = [...(satEvents as MusicEvent[] || []), ...satRecurring];
      const allSun = [...(sunEvents as MusicEvent[] || []), ...sunRecurring];

      // Deduplicate by ID
      const dedupeById = (events: MusicEvent[]): MusicEvent[] => {
        const seen = new Set<string>();
        return events.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      };

      const satMusic = dedupeById(allSat).filter(isLiveMusicEvent);
      const sunMusic = dedupeById(allSun).filter(isLiveMusicEvent);

      return {
        saturday: deduplicateByVenue(satMusic, 4),
        sunday: deduplicateByVenue(sunMusic, 4)
      };
    },
    staleTime: 300000,
  });

  // Weekday events (Tuesday through Friday, excluding today)
  const upcomingWeekdays = getUpcomingWeekdays();
  const { data: weekdayEvents } = useQuery({
    queryKey: ["live-music-weekdays", todayStr],
    queryFn: async () => {
      if (upcomingWeekdays.length === 0) {
        return {};
      }

      // Fetch recurring events to find those matching upcoming weekdays
      const { data: recurringEvents, error } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[LiveMusicWidget] Error loading weekday events", error);
        return {};
      }

      // Group events by day of week
      const eventsByDay: Record<string, MusicEvent[]> = {};
      
      for (const weekday of upcomingWeekdays) {
        const matchingEvents: MusicEvent[] = [];
        
        for (const event of (recurringEvents as MusicEvent[]) || []) {
          if (eventMatchesDay(event, weekday.dayOfWeek)) {
            matchingEvents.push(event);
          }
        }
        
        // Filter to music events and deduplicate
        const musicOnly = matchingEvents.filter(isLiveMusicEvent);
        const deduped = deduplicateByVenue(musicOnly, 3);
        
        if (deduped.length > 0) {
          eventsByDay[weekday.dayName] = deduped;
        }
      }
      
      return eventsByDay;
    },
    staleTime: 300000,
    enabled: upcomingWeekdays.length > 0,
  });

  const hasTonight = tonightEvents && tonightEvents.length > 0;
  const hasWeekdays = weekdayEvents && Object.keys(weekdayEvents).length > 0;
  const hasWeekend = weekendEvents && (weekendEvents.saturday.length > 0 || weekendEvents.sunday.length > 0);

  if (!hasTonight && !hasWeekdays && !hasWeekend) return null;

  return (
    <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      {/* Tonight Section */}
      {hasTonight && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Music className="h-4 w-4 text-purple-600" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Live Tonight
            </p>
          </div>
          
          <ul className="space-y-2.5">
            {tonightEvents.map((e) => {
              const venue = extractVenue(e.title);
              const displayName = venue || e.title;
              const displayPerformer = getDisplayPerformer(e);
              const showPerformer = shouldShowPerformer(displayName, displayPerformer);
              return (
                <li key={e.id} className="flex gap-2 items-start">
                  <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                  <div className="flex-1 min-w-0">
                    {e.original_url ? (
                      <a 
                        href={e.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-900 leading-snug hover:text-blue-600 transition-colors"
                        title={displayName}
                      >
                        {displayName}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-slate-900 leading-snug" title={displayName}>
                        {displayName}
                      </p>
                    )}
                    {(showPerformer || e.event_time) && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {showPerformer && displayPerformer}
                        {showPerformer && e.event_time && ' · '}
                        {e.event_time}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* This Week Section (Weekday events) */}
      {hasWeekdays && (
        <div className={hasTonight ? "mt-4 pt-4 border-t border-slate-100" : ""}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📅</span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              This Week
            </p>
          </div>

          {upcomingWeekdays.map(({ dayName }) => {
            const dayEvents = weekdayEvents![dayName];
            if (!dayEvents || dayEvents.length === 0) return null;
            
            return (
              <div key={dayName} className="mb-3">
                <p className="text-[11px] font-medium text-slate-400 mb-1.5">{dayName}</p>
                <ul className="space-y-2">
                  {dayEvents.map((e) => {
                    const venue = extractVenue(e.title);
                    const displayName = venue || e.title;
                    const displayPerformer = getDisplayPerformer(e);
                    const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                    return (
                      <li key={e.id} className="flex gap-2 items-start">
                        <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                        <div className="flex-1 min-w-0">
                          {e.original_url ? (
                            <a 
                              href={e.original_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-slate-900 leading-snug hover:text-blue-600 transition-colors"
                              title={displayName}
                            >
                              {displayName}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-slate-900 leading-snug" title={displayName}>
                              {displayName}
                            </p>
                          )}
                          {(showPerformer || e.event_time) && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {showPerformer && displayPerformer}
                              {showPerformer && e.event_time && ' · '}
                              {e.event_time}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekend Section */}
      {hasWeekend && (
        <div className={(hasTonight || hasWeekdays) ? "mt-4 pt-4 border-t border-slate-100" : ""}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🎸</span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              This Weekend
            </p>
          </div>

          {weekendEvents!.saturday.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-400 mb-1.5">Saturday</p>
              <ul className="space-y-2">
                {weekendEvents!.saturday.map((e) => {
                  const venue = extractVenue(e.title);
                  const displayName = venue || e.title;
                  const displayPerformer = getDisplayPerformer(e);
                  const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                  return (
                    <li key={e.id} className="flex gap-2 items-start">
                      <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-slate-900 leading-snug hover:text-blue-600 transition-colors"
                            title={displayName}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 leading-snug" title={displayName}>
                            {displayName}
                          </p>
                        )}
                        {(showPerformer || e.event_time) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {showPerformer && displayPerformer}
                            {showPerformer && e.event_time && ' · '}
                            {e.event_time}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {weekendEvents!.sunday.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-1.5">Sunday</p>
              <ul className="space-y-2">
                {weekendEvents!.sunday.map((e) => {
                  const venue = extractVenue(e.title);
                  const displayName = venue || e.title;
                  const displayPerformer = getDisplayPerformer(e);
                  const showPerformer = shouldShowPerformer(displayName, displayPerformer);
                  return (
                    <li key={e.id} className="flex gap-2 items-start">
                      <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-slate-900 leading-snug hover:text-blue-600 transition-colors"
                            title={displayName}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 leading-snug" title={displayName}>
                            {displayName}
                          </p>
                        )}
                        {(showPerformer || e.event_time) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {showPerformer && displayPerformer}
                            {showPerformer && e.event_time && ' · '}
                            {e.event_time}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <Link
        to="/lake-geneva?category=events"
        className="mt-3 block text-xs text-purple-600 hover:underline font-medium"
      >
        All events →
      </Link>
    </aside>
  );
}
