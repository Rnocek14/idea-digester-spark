import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Music } from "lucide-react";

type MusicEvent = {
  id: string;
  title: string;
  publish_date: string | null;
  original_url: string | null;
  metadata: { verticals?: string[]; content_tags?: string[] } | null;
  created_at: string;
};

function extractVenue(title: string): string {
  const atMatch = title.match(/(?:@|at)\s+(.+?)(?:\s*[-–]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  const venues = [
    'Geneva Tap House', 'PIER 290', 'Mars Resort', 'The Lookout Bar',
    'Evolve', 'Baker House', 'Hogs & Kisses', 'Topsy Turvy',
    'Maxwell Mansion', 'Abbey Resort'
  ];
  
  for (const venue of venues) {
    if (title.toLowerCase().includes(venue.toLowerCase())) {
      return venue;
    }
  }
  
  return '';
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

function getUpcomingWeekend(): { saturday: Date; sunday: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  if (daysUntilSaturday === 0 && now.getHours() >= 18) {
    // It's Saturday evening, show next weekend
    daysUntilSaturday = 7;
  } else if (daysUntilSaturday === 0) {
    // It's Saturday, keep it
  }
  
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  
  return { saturday, sunday };
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
  // Tonight's events (ingested today)
  const { data: tonightEvents } = useQuery({
    queryKey: ["live-music-tonight"],
    queryFn: async () => {
      const now = new Date();
      const todayMidnight = new Date(now);
      todayMidnight.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .gte("created_at", todayMidnight.toISOString())
        .order("publish_date", { ascending: true })
        .limit(12);

      if (error) {
        console.error("[LiveMusicWidget] Error loading tonight events", error);
        return [];
      }

      return deduplicateByVenue((data as MusicEvent[]) || [], 5);
    },
    staleTime: 300000,
  });

  // Weekend events (Saturday and Sunday)
  const { data: weekendEvents } = useQuery({
    queryKey: ["live-music-weekend"],
    queryFn: async () => {
      const { saturday, sunday } = getUpcomingWeekend();
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // Only fetch weekend events if it's not already the weekend
      // (If it's Saturday/Sunday, "tonight" already covers it)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { saturday: [], sunday: [] };
      }
      
      const saturdayEnd = new Date(saturday);
      saturdayEnd.setHours(23, 59, 59, 999);
      
      const sundayEnd = new Date(sunday);
      sundayEnd.setHours(23, 59, 59, 999);
      
      // Query events created within the last 7 days that have weekend dates
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata, created_at")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .gte("created_at", weekAgo.toISOString())
        .order("publish_date", { ascending: true })
        .limit(20);

      if (error) {
        console.error("[LiveMusicWidget] Error loading weekend events", error);
        return { saturday: [], sunday: [] };
      }

      // Filter by weekend dates in title or metadata
      const satEvents: MusicEvent[] = [];
      const sunEvents: MusicEvent[] = [];
      
      for (const event of (data as MusicEvent[]) || []) {
        const title = event.title.toLowerCase();
        // Check for day mentions in title
        if (title.includes('saturday') || title.includes('sat ')) {
          satEvents.push(event);
        } else if (title.includes('sunday') || title.includes('sun ')) {
          sunEvents.push(event);
        }
      }

      return {
        saturday: deduplicateByVenue(satEvents, 3),
        sunday: deduplicateByVenue(sunEvents, 3)
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
              return (
                <li key={e.id} className="flex gap-2 items-start">
                  <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                  <div className="flex-1 min-w-0">
                    {e.original_url ? (
                      <a 
                        href={e.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-900 leading-snug line-clamp-2 hover:text-blue-600 transition-colors"
                      >
                        {venue || e.title}
                      </a>
                    ) : (
                      <p className="text-sm text-slate-900 leading-snug line-clamp-2">
                        {venue || e.title}
                      </p>
                    )}
                    {venue && e.title !== venue && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {e.title.replace(/.*?(?:@|at)\s*/i, '').substring(0, 30)}
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
                  return (
                    <li key={e.id} className="flex gap-2 items-start">
                      <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-900 leading-snug line-clamp-1 hover:text-blue-600 transition-colors"
                          >
                            {venue || e.title}
                          </a>
                        ) : (
                          <p className="text-sm text-slate-900 leading-snug line-clamp-1">
                            {venue || e.title}
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
                  return (
                    <li key={e.id} className="flex gap-2 items-start">
                      <span className="mt-0.5 text-sm">{getEventEmoji(e.title, e.metadata?.content_tags)}</span>
                      <div className="flex-1 min-w-0">
                        {e.original_url ? (
                          <a 
                            href={e.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-900 leading-snug line-clamp-1 hover:text-blue-600 transition-colors"
                          >
                            {venue || e.title}
                          </a>
                        ) : (
                          <p className="text-sm text-slate-900 leading-snug line-clamp-1">
                            {venue || e.title}
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