import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCityId, maybeCity, runCityScoped } from "@/lib/cityId";
import {
  categoryEmoji,
  extractVenue,
  formatEventTime,
  getShortTitle,
  localDateStr,
  type EventRow,
} from "@/lib/eventUtils";

/**
 * Right-rail temporal flow: Tonight → This Weekend → Next Week.
 * Compact headline-only list (no images, no filter chips, no hero) —
 * pairs with EditorialLaterRail ("Worth a look") shown directly below.
 */
export default function RightRailTemporal({ fallback = null }: { fallback?: React.ReactNode }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["right-rail-temporal"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = localDateStr(today);
      const horizon = new Date(today);
      horizon.setDate(today.getDate() + 14);
      const horizonStr = localDateStr(horizon);

      const { data, error } = await runCityScoped((scoped) =>
        maybeCity(supabase
        .from("content_queue")
        .select(
          "id, title, summary, category, event_date, event_time, performer, original_url, image_url, geo_tier, geo_label, metadata",
        ), scoped)
        .in("status", ["approved", "auto_published", "published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .gte("event_date", todayStr)
        .lte("event_date", horizonStr)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(40)
      );
      if (error) throw error;
      return (data || []) as EventRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;

  const today = new Date();
  const todayStr = localDateStr(today);
  const day = today.getDay();
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

  const tonight: EventRow[] = [];
  const weekend: EventRow[] = [];
  const nextWeek: EventRow[] = [];
  for (const e of events) {
    if (!e.event_date) continue;
    if (e.event_date === todayStr) tonight.push(e);
    else if (e.event_date >= fridayStr && e.event_date <= sundayStr) weekend.push(e);
    else if (e.event_date >= nextWeekStartStr) nextWeek.push(e);
  }

  const sections: { key: string; label: string; hint: string; items: EventRow[] }[] = [
    { key: "tonight", label: "Tonight", hint: "Happening today", items: tonight.slice(0, 4) },
    {
      key: "weekend",
      label: "This Weekend",
      hint:
        friday.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " – " +
        sunday.toLocaleDateString([], { month: "short", day: "numeric" }),
      items: weekend.slice(0, 4),
    },
    { key: "next_week", label: "Next Week", hint: "Plan ahead", items: nextWeek.slice(0, 4) },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) return <>{fallback}</>;

  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.key}>
          <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-slate-200">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-900 font-semibold">
              {s.label}
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">{s.hint}</span>
          </div>
          <ul className="space-y-2">
            {s.items.map((e) => {
              const time = formatEventTime(e.event_time);
              const venue = extractVenue(e);
              const title = getShortTitle(e);
              let dayLabel = "";
              if (e.event_date && s.key !== "tonight") {
                const [y, m, d] = e.event_date.split("-").map(Number);
                dayLabel = new Date(y, (m || 1) - 1, d || 1).toLocaleDateString([], {
                  weekday: "short",
                });
              }
              return (
                <li key={e.id}>
                  <Link
                    to={`/events/${e.id}`}
                    className="group flex gap-2 items-start hover:bg-slate-50 -mx-2 px-2 py-1 rounded transition-colors"
                  >
                    <span className="mt-0.5 text-sm leading-none">
                      {categoryEmoji(e.category)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                        {dayLabel && <span className="font-medium">{dayLabel}</span>}
                        {dayLabel && (time || venue) && <span className="opacity-50"> · </span>}
                        {time && <span className="font-mono">{time}</span>}
                        {time && venue && <span className="opacity-50"> · </span>}
                        {venue && <span>{venue}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <Link
        to="/events"
        className="block text-[11px] font-mono uppercase tracking-wider text-blue-600 hover:underline"
      >
        All events →
      </Link>
    </div>
  );
}