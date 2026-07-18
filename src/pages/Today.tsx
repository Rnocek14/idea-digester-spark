import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Sunrise, Waves, Newspaper, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { PageMeta } from "@/components/PageMeta";
import WeatherWidget from "@/components/WeatherWidget";
import HappeningTodayWidget from "@/components/HappeningTodayWidget";
import LakeBeatLine from "@/components/LakeBeatLine";
import { storyPath } from "@/lib/slug";

/**
 * The Lake Report — the daily ritual page. One scannable card per visit:
 * the day's weather on the lake, top 3 stories, what's happening tonight,
 * and quick jumps into the rest of the Brief. Built to be bookmarkable
 * and shareable as a screenshot.
 */
export default function Today() {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const dateLabel = format(today, "EEEE, MMMM d");

  const { data: topStories = [] } = useQuery({
    queryKey: ["today-top-stories", todayISO],
    queryFn: async () => {
      // Recency window keeps "Top stories today" honest — without it, weeks-old
      // high-priority stories present as today's news with nothing signaling age.
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("content_queue")
        .select("id, title, summary, category, image_url, publish_date, created_at, geo_label")
        .in("status", ["published", "auto_published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .neq("category", "events")
        .gte("geo_tier", 1)
        .lte("geo_tier", 2)
        .gte("created_at", fortyEightHoursAgo)
        .order("priority_score", { ascending: false, nullsFirst: false })
        .order("publish_date", { ascending: false, nullsFirst: false })
        .limit(5);
      return data || [];
    },
    staleTime: 60_000,
  });

  const relativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    const diffMins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "The Lake Report — Lake Geneva today",
    description:
      "Lake Geneva at a glance: today's weather, top local stories, and what's happening tonight. Updated daily.",
    url: "https://lakegenevabrief.com/today",
    isPartOf: {
      "@type": "NewsMediaOrganization",
      name: "Lake Geneva Brief",
      url: "https://lakegenevabrief.com",
    },
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <PageMeta
        title="The Lake Report — Lake Geneva today, weather + what's open"
        description="Lake Geneva at a glance: today's weather, top local stories, what's happening tonight, sunrise + sunset. The daily Lake Geneva briefing, updated all day."
        path="/today"
        jsonLd={jsonLd}
        keywords={[
          "Lake Geneva today",
          "Lake Geneva weather",
          "Lake Geneva events tonight",
          "what's open Lake Geneva",
          "Lake Geneva sunrise sunset",
          "Lake Geneva Brief",
        ]}
      />
      <PublicHeader />

      <main className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex-1">
        {/* Masthead */}
        <header className="mb-6 pb-5 border-b-2 border-slate-900">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">
            {dateLabel} · Lake Geneva, WI
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-none"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            The Lake Report
          </h1>
          <p className="text-[13px] text-slate-600 mt-2 italic">
            One scannable look at Lake Geneva today — weather, stories, events.
          </p>
          <div className="mt-3">
            <LakeBeatLine />
          </div>
        </header>

        {/* Conditions strip */}
        <section
          aria-labelledby="conditions"
          className="mb-7 rounded-md border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-stone-50 px-5 py-4"
        >
          <h2
            id="conditions"
            className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-3 flex items-center gap-1.5"
          >
            <Sunrise className="h-3.5 w-3.5" /> On the lake right now
          </h2>
          <WeatherWidget />
          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-1.5">
            <Waves className="h-3 w-3" />
            Lake conditions update through the day — check the
            {" "}<Link to="/guides/lake-geneva-shore-path" className="text-blue-700 hover:underline">Shore Path</Link>
            {" "}guide for current trail notes.
          </p>
        </section>

        {/* Top 3 stories */}
        <section aria-labelledby="top-stories" className="mb-8">
          <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-200">
            <h2
              id="top-stories"
              className="text-sm font-mono uppercase tracking-[0.18em] text-slate-700 flex items-center gap-1.5"
            >
              <Newspaper className="h-3.5 w-3.5" /> Top stories today
            </h2>
            <Link to="/" className="text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
              Full feed <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topStories.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-4">
              Quiet morning so far — fresh stories drop through the day.
            </p>
          ) : (
            <ol className="space-y-4">
              {topStories.slice(0, 3).map((s, i) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-slate-400 tabular-nums mt-1 w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    {s.category && (
                      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
                        {s.category.replace(/_/g, " ")}
                        {s.geo_label ? ` · ${s.geo_label}` : ""}
                        {relativeTime(s.publish_date || s.created_at) ? ` · ${relativeTime(s.publish_date || s.created_at)}` : ""}
                      </p>
                    )}
                    <Link
                      to={storyPath(s.id, s.title)}
                      className="block text-[17px] text-slate-900 hover:text-blue-700 leading-snug font-bold transition-colors"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {s.title}
                    </Link>
                    {s.summary && (
                      <p className="text-[13.5px] text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                        {s.summary}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Happening today */}
        <section aria-labelledby="happening" className="mb-8">
          <h2 id="happening" className="sr-only">Happening today</h2>
          <HappeningTodayWidget />
        </section>

        {/* Quick jumps */}
        <section aria-labelledby="jumps" className="mb-10">
          <h2
            id="jumps"
            className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-3 flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" /> Plan the rest of your day
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { to: "/eats", label: "Where to eat" },
              { to: "/eats/fish-fry", label: "Tonight's fish fry" },
              { to: "/nightlife", label: "Live music + nightlife" },
              { to: "/events", label: "This weekend" },
              { to: "/guides/lake-geneva-shore-path", label: "Shore Path guide" },
              { to: "/guides/lake-geneva-faq", label: "Visitor FAQ" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] text-slate-800 hover:border-slate-400 hover:bg-stone-50 transition-colors min-h-[44px] flex items-center"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>

        <p className="text-center text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 pt-4 border-t border-slate-200">
          — Lake Geneva Brief · {format(today, "yyyy")}
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}