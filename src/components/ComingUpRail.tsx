import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, ArrowRight, Sparkles, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

const FILTERS: { value: string; label: string; match: (cat: string) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "music", label: "Music", match: (c) => c.includes("music") || c.includes("entertainment") },
  { value: "family", label: "Family", match: (c) => c.includes("family") },
  { value: "civic", label: "Civic", match: (c) => c.includes("civic") },
  { value: "arts", label: "Arts", match: (c) => c.includes("art") },
  { value: "outdoors", label: "Outdoors", match: (c) => c.includes("outdoor") || c.includes("sports") },
];

export default function ComingUpRail() {
  const [filter, setFilter] = useState<string>("all");
  const [tab, setTab] = useState<string>("tonight");

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

  // Hero pick: highest-priority Tier-1 weekend event in the next 14 days.
  const heroPick =
    events.find(
      (e) =>
        e.geo_tier === 1 &&
        e.event_date &&
        e.event_date >= fridayStr &&
        e.event_date <= sundayStr,
    ) ||
    events.find((e) => e.geo_tier === 1) ||
    events[0] ||
    null;

  const activeFilter = FILTERS.find((f) => f.value === filter) || FILTERS[0];
  const passesFilter = (e: EventRow) => activeFilter.match((e.category || "").toLowerCase());

  const seen = new Set<string>();
  if (heroPick) seen.add(heroPick.id);
  const tonight: EventRow[] = [];
  const weekend: EventRow[] = [];
  const nextWeek: EventRow[] = [];

  for (const e of events) {
    if (!e.event_date) continue;
    if (seen.has(e.id)) continue;
    if (!passesFilter(e)) continue;
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
    { key: "tonight", label: "Tonight", hint: "Happening today", events: tonight.slice(0, 7) },
    {
      key: "weekend",
      label: "This Weekend",
      hint: friday.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " – " +
        sunday.toLocaleDateString([], { month: "short", day: "numeric" }),
      events: weekend.slice(0, 7),
    },
    {
      key: "next_week",
      label: "Next Week",
      hint: "Plan ahead",
      events: nextWeek.slice(0, 7),
    },
  ] as Bucket[]).filter((b) => b.events.length > 0);

  if (buckets.length === 0 && !heroPick) return null;

  // Make sure the active tab actually has content; otherwise fall back to first available.
  const activeTabKey = buckets.find((b) => b.key === tab)?.key || buckets[0]?.key || "tonight";

  const heroVenue = heroPick ? extractVenue(heroPick) : "";
  const heroTime = heroPick ? formatEventTime(heroPick.event_time) : "";
  let heroDayLabel = "";
  if (heroPick && heroPick.event_date) {
    const [hy, hm, hd] = heroPick.event_date.split("-").map(Number);
    heroDayLabel = new Date(hy, (hm || 1) - 1, hd || 1).toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-foreground" />
          <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground font-semibold">
            ▪ COMING UP — EVERYTHING ON THE CALENDAR
          </h2>
        </div>
        <Link
          to="/events"
          className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
        >
          All events <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              filter === f.value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Hero pick — Brief Pick (now visually elevated with image) */}
      {heroPick && filter === "all" && (
        <Link
          to={`/events/${heroPick.id}`}
          className="group block mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-white ring-1 ring-amber-200 hover:ring-amber-300 hover:shadow-lg transition-all"
        >
          <div className="grid sm:grid-cols-[200px_1fr] gap-0">
            {heroPick.image_url ? (
              <div className="h-40 sm:h-full bg-slate-100 overflow-hidden">
                <img
                  src={heroPick.image_url}
                  alt={heroPick.title}
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="hidden sm:flex items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200 text-5xl">
                {categoryEmoji(heroPick.category)}
              </div>
            )}
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700 font-semibold">
                  Brief Pick · Worth leaving the house for
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                {categoryEmoji(heroPick.category)} {getShortTitle(heroPick)}
              </h3>
              {heroPick.summary && (
                <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                  {heroPick.summary}
                </p>
              )}
              <p className="mt-2 text-[12px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-900">{heroDayLabel}</span>
                {heroTime && <span className="opacity-40">·</span>}
                {heroTime && <span className="font-mono">{heroTime}</span>}
                {heroVenue && <span className="opacity-40">·</span>}
                {heroVenue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 opacity-60" /> {heroVenue}
                  </span>
                )}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Tabbed future events — only one list visible at a time */}
      {buckets.length > 0 && (
        <Tabs value={activeTabKey} onValueChange={setTab} className="w-full">
          <TabsList className="bg-slate-100 h-auto p-1 mb-3 flex-wrap">
            {buckets.map((b) => (
              <TabsTrigger
                key={b.key}
                value={b.key}
                className="text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900"
              >
                {b.label}
                <span className="ml-1.5 text-[10px] opacity-60 font-mono">
                  {b.events.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {buckets.map((bucket) => (
            <TabsContent key={bucket.key} value={bucket.key} className="mt-0">
              <div className="mb-2 text-[11px] text-slate-500 uppercase tracking-wider">
                {bucket.hint}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bucket.events.map((e) => {
                  const time = formatEventTime(e.event_time);
                  const venue = extractVenue(e);
                  const title = getShortTitle(e);
                  return (
                    <Link
                      key={e.id}
                      to={`/events/${e.id}`}
                      className="group flex gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100 hover:ring-slate-300 hover:shadow-sm transition-all"
                    >
                      {e.image_url ? (
                        <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                          <img
                            src={e.image_url}
                            alt={e.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-2xl">
                          {categoryEmoji(e.category)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          {time && <span className="font-medium">{time}</span>}
                          {time && venue && <span>·</span>}
                          {venue && <span className="truncate">{venue}</span>}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  );
}