import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { Json } from "@/integrations/supabase/types";
import { getCityId, maybeCity, runCityScoped } from "@/lib/cityId";

interface HappeningEvent {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  category: string | null;
  original_url: string | null;
  metadata: Json;
}

// Safely get metadata field
const getMetaField = (metadata: Json, field: string): string | undefined => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};

// Extract venue from title or metadata
const extractVenue = (event: HappeningEvent): string => {
  // Check metadata first
  const metaVenue = getMetaField(event.metadata, 'venue');
  if (metaVenue) return metaVenue;
  const metaLocation = getMetaField(event.metadata, 'location');
  if (metaLocation) return metaLocation;
  
  const title = event.title;
  
  // Common patterns: "Event at Venue" or "Event @ Venue"
  const atMatch = title.match(/\s(?:at|@)\s+(.+?)(?:\s*[-–—]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  // Pattern: "Venue: Event" or "Venue - Event"
  const colonMatch = title.match(/^([^:–—]+?)(?::|–|—)\s/);
  if (colonMatch && colonMatch[1].length < 40) return colonMatch[1].trim();
  
  return "";
};

// Extract short title (remove venue if it's in the title)
const getShortTitle = (event: HappeningEvent): string => {
  let title = event.title;
  
  // Remove "at Venue" suffix
  title = title.replace(/\s+(?:at|@)\s+.+$/i, '');
  
  // Remove "Venue: " prefix
  title = title.replace(/^[^:–—]+?(?::|–|—)\s+/, '');
  
  // Truncate if still too long
  if (title.length > 45) {
    title = title.substring(0, 42) + '...';
  }
  
  return title;
};

// Format time for display (12-hour format)
const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return "";
  
  // Handle various time formats
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return "";
  
  let hours = parseInt(match[1]);
  const minutes = match[2] || "00";
  const period = match[3]?.toLowerCase();
  
  // If no AM/PM specified, assume PM for afternoon/evening times
  let displayPeriod = period;
  if (!displayPeriod) {
    displayPeriod = hours >= 8 && hours < 12 ? "AM" : "PM";
  }
  
  // Convert to 12-hour format if needed
  if (hours > 12) {
    hours -= 12;
    displayPeriod = "PM";
  } else if (hours === 0) {
    hours = 12;
    displayPeriod = "AM";
  }
  
  return `${hours}:${minutes} ${displayPeriod?.toUpperCase() || "PM"}`;
};

// Check if event is pure nightlife (belongs in LATER, not here).
// Uses AI-classified verticals from metadata rather than title substrings,
// so marquee local events tagged ["local","nightlife"] (e.g. Riviera concerts)
// still surface here.
const isNightlifeOnly = (metadata: Json): boolean => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const v = (metadata as Record<string, unknown>).verticals;
  const arr: string[] = Array.isArray(v)
    ? (v as unknown[]).filter((x): x is string => typeof x === 'string')
    : (typeof (metadata as Record<string, unknown>).vertical === 'string'
        ? [(metadata as Record<string, unknown>).vertical as string]
        : []);
  if (arr.length === 0) return false;
  return arr.every((x) => x.toLowerCase() === 'nightlife');
};

// Guard against bad recurring-date data: if the title explicitly names a
// weekday that isn't today, hide it (e.g. "Friday Fish Fry" showing on a
// Wednesday because event_date was stamped incorrectly by the backfill).
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const mentionsWrongWeekday = (title: string, todayDow: number): boolean => {
  const t = title.toLowerCase();
  for (let i = 0; i < 7; i++) {
    if (i === todayDow) continue;
    // word-boundary match to avoid false positives
    const re = new RegExp(`\\b${WEEKDAYS[i]}\\b`, "i");
    if (re.test(t)) return true;
  }
  return false;
};

interface HappeningTodayWidgetProps {
  enabled?: boolean;
}

export default function HappeningTodayWidget({ enabled = true }: HappeningTodayWidgetProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDow = new Date().getDay();
  
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["happening-today", todayStr],
    queryFn: async () => {
      const { data, error } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("content_queue")
        .select("id, title, event_date, event_time, category, original_url, metadata"), scoped)
        .in("status", ["published", "auto_published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .eq("event_date", todayStr)
        .gte("geo_tier", 1)
        .lte("geo_tier", 2)
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(12)
      );
      
      if (error) throw error;
      
      // Filter out pure entertainment and dedupe by venue and by performer/title
      const seenVenue = new Set<string>();
      const seenTitle = new Set<string>();
      return (data || [])
        .filter((event: HappeningEvent) => {
          // Exclude pure nightlife (trivia/karaoke-only events)
          if (isNightlifeOnly(event.metadata)) return false;

          // Exclude events whose title names a different weekday (bad data)
          if (mentionsWrongWeekday(event.title, todayDow)) return false;

          // Dedupe by venue to avoid "Live at X" and "Trivia at X" both showing
          const venue = extractVenue(event).toLowerCase();
          if (venue && seenVenue.has(venue)) return false;

          // Dedupe by performer/short-title so the same act doesn't appear twice
          // (e.g. a venue-feed entry + a generic "Live Music" entry for the same performer)
          const performer = (getMetaField(event.metadata, 'performer') || '').toLowerCase().trim();
          const titleKey = performer || getShortTitle(event).toLowerCase().trim();
          const normalizedTitleKey = titleKey.replace(/\s+/g, ' ');
          if (normalizedTitleKey && seenTitle.has(normalizedTitleKey)) return false;

          if (venue) seenVenue.add(venue);
          if (normalizedTitleKey) seenTitle.add(normalizedTitleKey);

          return true;
        })
        .slice(0, 8) as HappeningEvent[];
    },
    staleTime: 60000,
    enabled,
  });

  // Dev-only logging for verification
  if (import.meta.env.DEV && events.length > 0) {
    console.log(`[HAPPENING TODAY] Showing ${events.length} events for ${todayStr}`);
  }

  if (!enabled) return null;
  
  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            ▪ HAPPENING TODAY
          </span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Industrial editorial header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground font-semibold">
          ▪ HAPPENING TODAY
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      
      {/* Tight agenda list */}
      <div className="space-y-0">
        {events.map((event) => {
          const time = formatTime(event.event_time);
          const venue = extractVenue(event);
          const shortTitle = getShortTitle(event);
          
          return (
            <a
              key={event.id}
              href={event.original_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 -mx-2 px-2 transition-colors min-h-[40px] group"
            >
              {/* Time - monospace, fixed width */}
              <span className="text-xs font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                {time || "—"}
              </span>
              
              {/* Venue - medium weight, truncate */}
              {venue && (
                <span className="text-sm font-medium text-foreground truncate max-w-[120px] shrink-0">
                  {venue}
                </span>
              )}
              
              {/* Title - flex to fill, truncate */}
              <span className="text-sm text-muted-foreground group-hover:text-foreground truncate flex-1 transition-colors">
                {shortTitle}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
