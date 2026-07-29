import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { getCityId, runCityScoped } from "@/lib/cityId";
import {
  EVENT_CATEGORIES,
  categoryEmoji,
  downloadIcs,
  extractVenue,
  formatEventTime,
  formatFullDate,
  friendlyDayLabel,
  getShortTitle,
  localDateStr,
  type EventRow,
} from "@/lib/eventUtils";

type GeoFilter = "all" | "lake_geneva" | "walworth";

export default function Events() {
  const [category, setCategory] = useState<string>("all");
  const [geo, setGeo] = useState<GeoFilter>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events-page"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = localDateStr(today);
      const horizon = new Date(today);
      horizon.setDate(today.getDate() + 60);
      const horizonStr = localDateStr(horizon);

      const { data, error } = await runCityScoped((scoped) => {
          let q = supabase.from("content_queue").select(
          "id, title, summary, category, event_date, event_time, performer, original_url, image_url, geo_tier, geo_label, metadata",
        );
          if (scoped) q = q.eq("city_id", getCityId());
          return q
        .in("status", ["approved", "auto_published", "published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .gte("event_date", todayStr)
        .lte("event_date", horizonStr)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false })
        .limit(500);
        });

      if (error) throw error;
      return (data || []) as EventRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const seen = new Set<string>();
    return events.filter((e) => {
      if (!e.event_date) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      if (category !== "all" && (e.category || "").toLowerCase() !== category) return false;
      if (geo === "lake_geneva" && e.geo_tier !== 1) return false;
      if (geo === "walworth" && e.geo_tier !== 2) return false;
      return true;
    });
  }, [events, category, geo]);

  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of filtered) {
      const key = e.event_date as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()); // already sorted by query
  }, [filtered]);

  return (
    <PageShell>
      <PageMeta
        title="Lake Geneva Events Calendar — What's Coming Up"
        description="Music, festivals, family, civic, and community events around Lake Geneva, Williams Bay, Fontana, and Walworth County."
        path="/events"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-5 w-5 text-primary" />
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
              Lake Geneva Events
            </p>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-slate-900">
            What's coming up on the lake
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Live music, festivals, family days, civic meetings, and community happenings —
            in Lake Geneva, Williams Bay, Fontana, and around Walworth County.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {EVENT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${
                  category === c.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: "all", l: "All locations" },
              { v: "lake_geneva", l: "Lake Geneva" },
              { v: "walworth", l: "Walworth County" },
            ] as { v: GeoFilter; l: string }[]).map((g) => (
              <button
                key={g.v}
                type="button"
                onClick={() => setGeo(g.v)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  geo === g.v
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {g.l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading events…</div>
        ) : grouped.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-900 font-medium">No events match those filters.</p>
            <p className="text-slate-500 text-sm mt-1">
              Try a different category or location.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([date, items]) => (
              <section key={date}>
                <div className="sticky top-[120px] z-10 bg-stone-50/95 backdrop-blur-sm py-2 mb-2 border-b border-slate-200">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    {friendlyDayLabel(date)}
                  </p>
                  <h2 className="text-base font-semibold text-slate-900">
                    {formatFullDate(date)}
                  </h2>
                </div>
                <ul className="space-y-2">
                  {items.map((e) => {
                    const time = formatEventTime(e.event_time);
                    const venue = extractVenue(e);
                    const title = getShortTitle(e);
                    return (
                      <li
                        key={e.id}
                        className="rounded-md bg-white p-3 ring-1 ring-slate-200 hover:ring-slate-300 transition-shadow"
                      >
                        <div className="flex gap-3 items-start">
                          <span className="text-lg shrink-0 leading-tight">
                            {categoryEmoji(e.category)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/events/${e.id}`}
                              className="block text-sm font-medium text-slate-900 hover:text-blue-700 leading-snug"
                            >
                              {title}
                            </Link>
                            <p className="mt-1 text-[12px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                              {time && (
                                <span className="font-mono tabular-nums">{time}</span>
                              )}
                              {time && venue && <span className="opacity-40">·</span>}
                              {venue && <span>{venue}</span>}
                              {e.geo_label && (
                                <>
                                  <span className="opacity-40">·</span>
                                  <span className="text-slate-500">{e.geo_label}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] text-slate-600 hover:text-slate-900 shrink-0"
                            onClick={() => downloadIcs(e)}
                            aria-label="Add to calendar"
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}