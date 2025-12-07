import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Music } from "lucide-react";

type MusicEvent = {
  id: string;
  title: string;
  publish_date: string | null;
  original_url: string | null;
  metadata: { verticals?: string[]; content_tags?: string[]; event_date?: string } | null;
  event_date: string | null;
  event_time: string | null;
  performer: string | null;
  created_at: string;
};

function extractVenue(title: string): string {
  const atMatch = title.match(/(?:@|at)\s+(.+?)(?:\s*[-–]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  const venues = [
    'Geneva Tap House', 'PIER 290', 'Mars Resort', 'The Lookout Bar',
    'Evolve', 'Baker House', 'Hogs & Kisses', 'Topsy Turvy',
    'Maxwell Mansion', 'Abbey Resort', 'Lake Lawn Resort', 'Grand Geneva'
  ];
  
  for (const venue of venues) {
    if (title.toLowerCase().includes(venue.toLowerCase())) {
      return venue;
    }
  }
  
  return '';
}

// Filter to only include actual live music events
function isLiveMusicEvent(event: MusicEvent): boolean {
  const title = event.title.toLowerCase();
  const performer = event.performer?.toLowerCase() || '';
  
  // FIRST: Hard exclude non-music events by title (highest priority)
  const excludeTitleKeywords = [
    'ladies night', 'trivia', 'comedy', 'penn & teller', 'penn and teller',
    'bingo', 'game night', 'wine tasting', 'wine night', 'paint night',
    'yoga', 'brunch', 'wonderful!', 'magic show', 'poker', 'fish fry',
    'new year', 'happy new year', 'thank you for attending', 'casino',
    'skeptics', 'las vegas headliners'
  ];
  
  const isTitleExcluded = excludeTitleKeywords.some(kw => title.includes(kw));
  if (isTitleExcluded) return false;
  
  // SECOND: Validate performer field is actually a person name (not garbage text)
  const isValidPerformer = performer.length > 0 && 
    performer.length < 50 && // Real names are short
    !performer.includes('http') &&
    !performer.includes('ladies') &&
    !performer.includes('penn') &&
    !performer.includes('humor') &&
    !performer.includes('wit') &&
    !performer.includes('casino') &&
    !performer.includes('cocktail') &&
    !performer.includes('fish fry') &&
    !performer.includes('carson hall') &&
    performer !== title.toLowerCase(); // Performer shouldn't match title
  
  // Must have "live music" in title OR have a valid performer
  const hasLiveMusic = title.includes('live music') || title.includes('live:');
  
  return hasLiveMusic || isValidPerformer;
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

function getUpcomingWeekendDates(): { saturday: string; sunday: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  if (daysUntilSaturday === 0 && now.getHours() >= 18) {
    // It's Saturday evening, show next weekend
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

function deduplicateByVenue(events: MusicEvent[], limit: number): MusicEvent[] {
  const seenVenues = new Set<string>();
  const uniqueEvents: MusicEvent[] = [];
  
  for (const event of events) {
    const venue = extractVenue(event.title).toLowerCase();
    if (venue && seenVenues.has(venue)) continue;
    if (venue) seenVenues.add(venue);
    uniqueEvents.push(event);
    if (uniqueEvents.length >= limit) break;
  }
  
  return uniqueEvents;
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

      // Fallback: check for events ingested today without event_date (legacy)
      const now = new Date();
      const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      
      const { data: fallbackEvents, error: fallbackError } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .is("event_date", null)
        .gte("created_at", utcMidnight.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (fallbackError) {
        console.error("[LiveMusicWidget] Error loading tonight fallback events", fallbackError);
      }

      // Merge and deduplicate
      const allEvents = [...(dateEvents || []), ...(fallbackEvents || [])] as MusicEvent[];
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

  // Weekend events - use event_date column
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

      // Fallback: if no events with event_date, check title keywords in recent events
      if ((!satEvents || satEvents.length === 0) && (!sunEvents || sunEvents.length === 0)) {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const { data: fallback } = await supabase
          .from("content_queue")
          .select("id, title, publish_date, original_url, metadata, event_date, event_time, performer, created_at")
          .in("status", ["approved", "auto_published", "published"])
          .eq("safety_level", "safe")
          .eq("category", "events")
          .contains("metadata", { verticals: ["nightlife"] })
          .is("event_date", null)
          .gte("created_at", weekAgo.toISOString())
          .limit(20);

        const satFallback: MusicEvent[] = [];
        const sunFallback: MusicEvent[] = [];

        for (const event of (fallback as MusicEvent[]) || []) {
          const title = event.title.toLowerCase();
          if (title.includes('saturday') || title.includes('sat ')) {
            satFallback.push(event);
          } else if (title.includes('sunday') || title.includes('sun ')) {
            sunFallback.push(event);
          }
        }

        // Filter to music only
        const satMusic = satFallback.filter(isLiveMusicEvent);
        const sunMusic = sunFallback.filter(isLiveMusicEvent);

        return {
          saturday: deduplicateByVenue(satMusic, 3),
          sunday: deduplicateByVenue(sunMusic, 3)
        };
      }

      // Filter to music only
      const satMusic = ((satEvents as MusicEvent[]) || []).filter(isLiveMusicEvent);
      const sunMusic = ((sunEvents as MusicEvent[]) || []).filter(isLiveMusicEvent);

      return {
        saturday: deduplicateByVenue(satMusic, 3),
        sunday: deduplicateByVenue(sunMusic, 3)
      };
    },
    staleTime: 300000,
  });

  const hasTonight = tonightEvents && tonightEvents.length > 0;
  const hasWeekend = weekendEvents && (weekendEvents.saturday.length > 0 || weekendEvents.sunday.length > 0);

  if (!hasTonight && !hasWeekend) return null;

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
              const displayPerformer = e.performer || (venue ? null : e.title.replace(/.*?(?:@|at)\s*/i, '').substring(0, 40));
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
                        title={venue || e.title}
                      >
                        {venue || e.title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-slate-900 leading-snug" title={venue || e.title}>
                        {venue || e.title}
                      </p>
                    )}
                    {(displayPerformer || e.event_time) && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {displayPerformer}{displayPerformer && e.event_time && ' · '}{e.event_time}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Weekend Section */}
      {hasWeekend && (
        <div className={hasTonight ? "mt-4 pt-4 border-t border-slate-100" : ""}>
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
                  const displayPerformer = e.performer || null;
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
                            title={venue || e.title}
                          >
                            {venue || e.title}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 leading-snug" title={venue || e.title}>
                            {venue || e.title}
                          </p>
                        )}
                        {(displayPerformer || e.event_time) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {displayPerformer}{displayPerformer && e.event_time && ' · '}{e.event_time}
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
                  const displayPerformer = e.performer || null;
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
                            title={venue || e.title}
                          >
                            {venue || e.title}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 leading-snug" title={venue || e.title}>
                            {venue || e.title}
                          </p>
                        )}
                        {(displayPerformer || e.event_time) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {displayPerformer}{displayPerformer && e.event_time && ' · '}{e.event_time}
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
