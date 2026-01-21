import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { Json } from "@/integrations/supabase/types";

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

// Check if event is pure entertainment (belongs in LATER, not here)
const isPureEntertainment = (title: string): boolean => {
  const t = title.toLowerCase().replace(/[']/g, "'");
  return (
    t.includes('live music') ||
    t.includes('concert at') ||
    t.includes('music at') ||
    t.includes('music @') ||
    t.includes('band at') ||
    t.includes('karaoke') ||
    t.includes('trivia') ||
    t.includes('open mic') ||
    t.includes('dj at') ||
    t.includes("ladies' night") ||
    t.includes("ladies night") ||
    t.includes("dueling pianos")
  );
};

interface HappeningTodayWidgetProps {
  enabled?: boolean;
}

export default function HappeningTodayWidget({ enabled = true }: HappeningTodayWidgetProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["happening-today", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, event_date, event_time, category, original_url, metadata")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .eq("event_date", todayStr)
        .gte("geo_tier", 1)
        .lte("geo_tier", 2)
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(12);
      
      if (error) throw error;
      
      // Filter out pure entertainment and dedupe by venue
      const seen = new Set<string>();
      return (data || [])
        .filter((event: HappeningEvent) => {
          // Exclude pure entertainment
          if (isPureEntertainment(event.title)) return false;
          
          // Dedupe by venue to avoid "Live at X" and "Trivia at X" both showing
          const venue = extractVenue(event).toLowerCase();
          if (venue && seen.has(venue)) return false;
          if (venue) seen.add(venue);
          
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
