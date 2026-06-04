import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  categoryEmoji,
  extractVenue,
  formatEventTime,
  getShortTitle,
  localDateStr,
  type EventRow,
} from "@/lib/eventUtils";

type Bucket = {
  key: "tonight" | "weekend" | "next_week";
  label: string;
  hint: string;
  events: EventRow[];
};

export default function ComingUpRail() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["coming-up-rail"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = localDateStr(today);
      const horizon = new Date(today);
      horizon.setDate(today.getDate() + 14);
      const horizonStr = localDateStr(horizon);

      const { data, error } = await supabase
        .from("content_queue")
        .select(
          "id, title, summary, category, event_date, event_time, performer, original_url, image_url, geo_tier, geo_label, metadata",
        )
        .in("status", ["approved", "auto_published", "published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .gte("event_date", todayStr)
        .lte("event_date", horizonStr)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(60);

      if (error) throw error;
      return (data || []) as EventRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  if (events.length === 0) return null;

  const today = new Date();
  const todayStr = localDateStr(today);

  // This weekend = upcoming Fri/Sat/Sun (or remainder if mid-weekend)
  const day = today.getDay(); // 0=Sun..6=Sat
  const daysUntilFriday = day === 0 ? -2 : (5 - day + 7) % 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  const fridayStr = localDateStr(friday);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  const sundayStr = localDateStr(sunday);

  const nextWeekStart = new Date(sunday);
  nextWeekStart.setDate(sunday.getDate() + 1);
  const nextWeekStartStr = localDateStr(nextWeekStart);

  const seen = new Set<string>();
  const tonight: EventRow[] = [];
  const weekend: EventRow[] = [];
  const nextWeek: EventRow[] = [];

  for (const e of events) {
    if (!e.event_date) continue;
    if (seen.has(e.id)) continue;
    if (e.event_date === todayStr) {
      tonight.push(e);
      seen.add(e.id);
    } else if (e.event_date >= fridayStr && e.event_date <= sundayStr) {
      weekend.push(e);
      seen.add(e.id);
    } else if (e.event_date >= nextWeekStartStr) {
      nextWeek.push(e);
      seen.add(e.id);
    }
  }

  const buckets: Bucket[] = ([
    { key: "tonight", label: "Tonight", hint: "Happening today", events: tonight.slice(0, 5) },
    {
      key: "weekend",
      label: "This Weekend",
      hint: friday.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " – " +
        sunday.toLocaleDateString([], { month: "short", day: "numeric" }),
      events: weekend.slice(0, 5),
    },
    {
      key: "next_week",
      label: "Next Week",
      hint: "Plan ahead",
      events: nextWeek.slice(0, 5),
    },
  ] as Bucket[]).filter((b) => b.events.length > 0);

  if (buckets.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-foreground" />
          <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground font-semibold">
            ▪ COMING UP
          </h2>
        </div>
        <Link
          to="/events"
          className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
        >
          All events <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">{bucket.label}</h3>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {bucket.hint}
              </span>
            </div>
            <ul className="space-y-2.5">
              {bucket.events.map((e) => {
                const time = formatEventTime(e.event_time);
                const venue = extractVenue(e);
                const title = getShortTitle(e);
                return (
                  <li key={e.id}>
                    <Link
                      to={`/events/${e.id}`}
                      className="group flex gap-2 items-start"
                    >
                      <span className="mt-0.5 text-sm shrink-0">
                        {categoryEmoji(e.category)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          {time && <span className="font-medium">{time}</span>}
                          {time && venue && <span>·</span>}
                          {venue && <span className="truncate">{venue}</span>}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}