import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { formatEventTime, localDateStr, type EventRow } from "@/lib/eventUtils";
import { getCityId } from "@/lib/cityId";

type Pick = EventRow & {
  featured_in_later?: boolean;
  featured_rank?: number | null;
  editorial_pick_reason?: string | null;
};

/**
 * Renders the editorial Later picks.
 * Primary: featured_in_later = true, featured_until >= today, ordered by featured_rank.
 * Fallback: highest geo_tier upcoming events 5-30 days out (so the slot is never empty).
 */
export default function EditorialLaterRail() {
  const today = localDateStr(new Date());
  const horizon = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return localDateStr(d);
  })();

  const { data: featured = [], isLoading } = useQuery({
    queryKey: ["later-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select(
          "id, title, summary, category, event_date, event_time, image_url, geo_tier, geo_label, original_url, featured_rank, editorial_pick_reason, featured_in_later",
        )
        .eq("city_id", getCityId())
        .eq("featured_in_later", true)
        .gte("featured_until", today)
        .in("status", ["approved", "auto_published", "published"])
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data || []) as Pick[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const fallbackStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return localDateStr(d);
  })();

  const { data: fallback = [] } = useQuery({
    queryKey: ["later-fallback"],
    enabled: !isLoading && featured.length < 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select(
          "id, title, summary, category, event_date, event_time, image_url, geo_tier, geo_label, original_url",
        )
        .eq("city_id", getCityId())
        .in("status", ["approved", "auto_published", "published"])
        .in("safety_level", ["safe", "soft_sensitive"])
        .gte("event_date", fallbackStart)
        .lte("event_date", horizon)
        .order("geo_tier", { ascending: true })
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data || []) as Pick[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const picks: Pick[] = featured.length > 0 ? featured : fallback;
  const isCurated = featured.length > 0;

  if (isLoading) return null;
  if (picks.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          {isCurated ? "Editor's Picks" : "Worth a look"}
        </h3>
        <Link to="/events" className="text-[10px] font-mono text-slate-500 hover:text-slate-900">
          all events →
        </Link>
      </div>
      <div className="space-y-2">
        {picks.map((p) => {
          const time = formatEventTime(p.event_time);
          const dateLabel = p.event_date
            ? new Date(p.event_date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "";
          return (
            <Link
              key={p.id}
              to={`/events/${p.id}`}
              className="block rounded-md border border-amber-200 bg-amber-50/50 p-3 hover:bg-amber-50 transition-colors"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-700">
                {dateLabel}{time ? ` · ${time}` : ""}
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug">
                {p.title}
              </p>
              {isCurated && p.editorial_pick_reason && (
                <p className="text-xs text-slate-600 mt-1 italic leading-snug">
                  {p.editorial_pick_reason}
                </p>
              )}
              {!isCurated && p.summary && (
                <p className="text-xs text-slate-600 mt-1 leading-snug line-clamp-2">
                  {p.summary}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}