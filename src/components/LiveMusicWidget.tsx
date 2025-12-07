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
};

function extractVenue(title: string): string {
  // Try to extract venue from common patterns like "Live Music @ VENUE" or "at VENUE"
  const atMatch = title.match(/(?:@|at)\s+(.+?)(?:\s*[-–]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  // Known venues
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

function formatEventDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Tonight";
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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

export default function LiveMusicWidget() {
  const { data: events } = useQuery({
    queryKey: ["live-music-sidebar"],
    queryFn: async () => {
      const now = new Date();
      
      // Filter for events ingested today only (to avoid showing yesterday's events)
      const todayMidnight = new Date(now);
      todayMidnight.setHours(0, 0, 0, 0);
      
      // Query for nightlife vertical content (AI-tagged at ingestion)
      const { data, error } = await supabase
        .from("content_queue")
        .select("id, title, publish_date, original_url, metadata")
        .in("status", ["approved", "auto_published", "published"])
        .eq("safety_level", "safe")
        .eq("category", "events")
        .contains("metadata", { verticals: ["nightlife"] })
        .gte("created_at", todayMidnight.toISOString())
        .order("publish_date", { ascending: true })
        .limit(12);

      if (error) {
        console.error("[LiveMusicWidget] Error loading events", error);
        return [];
      }

      // Deduplicate by venue (keep only the most recent per venue)
      const seenVenues = new Set<string>();
      const uniqueEvents: MusicEvent[] = [];
      
      for (const event of (data as MusicEvent[]) || []) {
        const venue = extractVenue(event.title).toLowerCase();
        if (venue && seenVenues.has(venue)) continue;
        if (venue) seenVenues.add(venue);
        uniqueEvents.push(event);
        if (uniqueEvents.length >= 5) break;
      }

      return uniqueEvents;
    },
    staleTime: 300000, // 5 min
  });

  // Hide if no music events
  if (!events || events.length === 0) return null;

  return (
    <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <Music className="h-4 w-4 text-purple-600" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Live Music
        </p>
      </div>
      
      <ul className="space-y-2.5">
        {events.map((e) => {
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
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatEventDate(e.publish_date)}
                  {venue && e.title !== venue && (
                    <span className="ml-1 text-slate-300">•</span>
                  )}
                  {venue && e.title !== venue && (
                    <span className="ml-1 truncate">{e.title.replace(/.*?(?:@|at)\s*/i, '').substring(0, 25)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        to="/lake-geneva?category=events"
        className="mt-3 block text-xs text-purple-600 hover:underline font-medium"
      >
        All events →
      </Link>
    </aside>
  );
}
