// Turn search traffic into readers.
//
// The guides are where nearly all search traffic lands, and analytics say those
// readers leave from the same page they arrived on (~79% bounce, 1.7 pages per
// visit). Every guide already ends with related guides and a newsletter block,
// but nothing ever showed a guide reader that this is a LIVE local paper.
//
// So: a small "Lake Geneva right now" strip on every guide, fed by the same
// published/local rules the homepage uses. Renders nothing when there is no
// fresh local story — an empty or stale strip is worse than no strip.

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { runCityScoped } from "@/lib/cityId";
import { storyPath } from "@/lib/slug";

type Row = {
  id: string;
  title: string;
  category: string | null;
  publish_date: string | null;
  created_at: string;
};

// Obituary roundups are a real part of local news but a terrible first
// impression on a guide about beaches. Same exclusion Today's Brief uses.
const isObituary = (title: string) => /obituar/i.test(title || "");

const relativeDay = (iso?: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function GuideLocalNow() {
  const { data: stories = [] } = useQuery({
    queryKey: ["guide-local-now"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data, error } = await runCityScoped((scoped) => {
        let q = supabase
          .from("content_queue")
          .select("id, title, category, publish_date, created_at");
        if (scoped) q = q.eq("city_id", getCity());
        return q
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          .gte("geo_tier", 1)
          .gte("publish_date", since)
          .order("publish_date", { ascending: false })
          .limit(12);
      });
      if (error) throw error;
      return ((data ?? []) as Row[]).filter((r) => !isObituary(r.title)).slice(0, 3);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (stories.length === 0) return null;

  return (
    <section className="mt-12 rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Lake Geneva right now
        </p>
        <Link to="/" className="text-xs text-blue-700 hover:underline shrink-0">
          Today's brief →
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {stories.map((s) => (
          <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
            <Link
              to={storyPath(s.id, s.title)}
              className="group flex items-start justify-between gap-4"
            >
              <span className="text-slate-800 leading-snug group-hover:text-blue-700">
                {s.title}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wide text-slate-400 shrink-0 pt-0.5">
                {relativeDay(s.publish_date)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Kept local so the query function can read the resolved city without the
// component threading it through props.
import { getCityId } from "@/lib/cityId";
function getCity() {
  return getCityId();
}
