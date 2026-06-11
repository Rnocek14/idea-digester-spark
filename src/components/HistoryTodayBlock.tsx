import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackStoryEvent } from "@/lib/trackStoryEvent";

type Entry = {
  id: string;
  title: string;
  body: string;
  event_year: number | null;
  source_citation: string | null;
  history_type: string | null;
};

/**
 * "Today in Lake Geneva History" — anchored daily content block.
 * Reads from history_entries by day_of_year so a story always appears,
 * even on slow news days. Pure read; no AI invention.
 */
export default function HistoryTodayBlock() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Postgres EXTRACT(DOY) — JS equivalent: day of year, 1-indexed.
      const now = new Date();
      const start = Date.UTC(now.getUTCFullYear(), 0, 0);
      const diff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start;
      const doy = Math.floor(diff / 86_400_000);

      // Prefer exact day match; if none, fall back to nearest within ±30 days
      // (forward) so the block never goes dark while the library is small.
      const exact = await supabase
        .from("history_entries")
        .select("id,title,body,event_year,source_citation,history_type")
        .eq("status", "approved")
        .eq("day_of_year", doy)
        .order("event_year", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (exact.data) {
        if (!cancelled) {
          setEntry(exact.data as Entry);
          setLoading(false);
        }
        return;
      }

      const fallback = await supabase
        .from("history_entries")
        .select("id,title,body,event_year,source_citation,history_type")
        .eq("status", "approved")
        .gte("day_of_year", doy)
        .order("day_of_year", { ascending: true })
        .limit(1)
        .maybeSingle();

      let chosen = fallback.data as Entry | null;
      if (!chosen) {
        const wrap = await supabase
          .from("history_entries")
          .select("id,title,body,event_year,source_citation,history_type")
          .eq("status", "approved")
          .order("day_of_year", { ascending: true })
          .limit(1)
          .maybeSingle();
        chosen = (wrap.data as Entry | null) ?? null;
      }

      if (!cancelled) {
        setEntry(chosen);
        setLoading(false);
        if (chosen?.id) {
          trackStoryEvent({
            pillar: "history",
            eventType: "homepage_impression",
            entityType: "history_entry",
            entityId: chosen.id,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !entry) return null;

  const todayLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <aside
      aria-label="Today in Lake Geneva History"
      className="mb-8 rounded-md border border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-white to-stone-50 px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-amber-200/70">
        <h2
          className="text-base sm:text-lg text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
        >
          Today in Lake Geneva History
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
          {todayLabel}
          {entry.event_year ? ` · ${entry.event_year}` : ""}
        </span>
      </div>

      <h3
        className="text-[17px] sm:text-[18px] text-slate-900 mb-2 leading-snug"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600 }}
      >
        {entry.title}
      </h3>
      <p className="text-[14.5px] text-slate-700 leading-relaxed">{entry.body}</p>

      {entry.source_citation && (
        <p className="mt-4 pt-3 border-t border-amber-200/70 text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Source: {entry.source_citation}
        </p>
      )}
    </aside>
  );
}