import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCityId } from "@/lib/cityId";
import { useCityConfig } from "@/hooks/useCityConfig";
import { storyPath } from "@/lib/slug";

type RecapStory = { id: string; title: string };

/**
 * The Sunday "your week in review" block. Shows for a few days after
 * publication, then steps aside for the daily rhythm.
 *
 * Byline is always the desk — never a fabricated person. The recap only ever
 * summarizes stories we already published, and links back to them so a reader
 * can verify every claim.
 */
export default function WeeklyRecapBlock({ sponsorSlot }: { sponsorSlot?: React.ReactNode }) {
  const city = useCityConfig();

  const { data: recap } = useQuery({
    queryKey: ["weekly-recap", getCityId()],
    queryFn: async () => {
      // Visible for 4 days after the week closes, so a Sunday recap carries
      // through Wednesday and then yields to the daily brief.
      const cutoff = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("weekly_recaps")
        .select("week_start, week_end, body, headline, mentioned_story_ids, story_count, is_quiet_week")
        .eq("city_id", getCityId())
        .eq("status", "published")
        .gte("week_end", cutoff)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as {
        week_start: string;
        week_end: string;
        body: string;
        headline: string | null;
        mentioned_story_ids: string[];
        story_count: number;
        is_quiet_week: boolean;
      } | null;
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: linkedStories = [] } = useQuery({
    queryKey: ["weekly-recap-stories", recap?.week_start, getCityId()],
    enabled: !!recap?.mentioned_story_ids?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("content_queue")
        .select("id, title")
        .in("id", recap!.mentioned_story_ids)
        .limit(8);
      return (data ?? []) as RecapStory[];
    },
    staleTime: 30 * 60 * 1000,
  });

  if (!recap?.body) return null;

  const range = `${new Date(recap.week_start + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })} – ${new Date(recap.week_end + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })}`;

  return (
    <section
      aria-labelledby="weekly-recap"
      className="mb-8 rounded-sm border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p
          id="weekly-recap"
          className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500"
        >
          The week in review
        </p>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 whitespace-nowrap">
          {range}
        </span>
      </div>

      <h2
        className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mb-3"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {recap.headline || "Your week in review"}
      </h2>

      <div className="space-y-3">
        {recap.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-slate-700">
            {para}
          </p>
        ))}
      </div>

      {linkedStories.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Stories referenced
          </p>
          <ul className="space-y-1">
            {linkedStories.map((s) => (
              <li key={s.id}>
                <Link
                  to={storyPath(s.id, s.title)}
                  className="text-[13px] text-slate-600 hover:text-blue-700 hover:underline leading-snug"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] italic text-slate-500">
        — The {city.site_name} desk
        {recap.story_count > 0 && (
          <span className="not-italic">
            {" · "}
            {recap.story_count} {recap.story_count === 1 ? "story" : "stories"} published this week
          </span>
        )}
      </p>

      {sponsorSlot && <div className="mt-3 pt-3 border-t border-slate-100">{sponsorSlot}</div>}
    </section>
  );
}
