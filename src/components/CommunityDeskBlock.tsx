import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Mic, PenSquare } from "lucide-react";

type Love = {
  id: string;
  body: string;
  subject_name: string | null;
  submitter_name: string | null;
  category: string | null;
};
type Voice = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  community_authors: { display_name: string } | null;
};
type Stats = { submissions: number; published: number; businesses: number };

export default function CommunityDeskBlock() {
  const { data } = useQuery({
    queryKey: ["community-desk-block"],
    queryFn: async () => {
      const [love, voice, totalSubs, publishedSubs, publishedPosts, businesses] =
        await Promise.all([
          supabase
            .from("community_submissions")
            .select("id, body, subject_name, submitter_name, category")
            .eq("kind", "local_love")
            .in("status", ["approved", "published"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("community_posts")
            .select("id, slug, title, excerpt, category, community_authors!author_id(display_name)")
            .eq("status", "published")
            .neq("category", "throwback")
            .order("published_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("community_submissions")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("community_submissions")
            .select("id", { count: "exact", head: true })
            .in("status", ["approved", "published"]),
          supabase
            .from("community_posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "published"),
          supabase
            .from("community_submissions")
            .select("id", { count: "exact", head: true })
            .eq("kind", "local_love")
            .in("status", ["approved", "published"])
            .not("subject_name", "is", null),
        ]);
      const stats: Stats = {
        submissions: (totalSubs.count || 0),
        published: (publishedSubs.count || 0) + (publishedPosts.count || 0),
        businesses: businesses.count || 0,
      };
      return {
        love: (love.data as Love | null) || null,
        voice: (voice.data as unknown as Voice | null) || null,
        stats,
      };
    },
  });

  const love = data?.love;
  const voice = data?.voice;
  const stats = data?.stats;

  return (
    <section className="mb-8 rounded-md border border-slate-200 bg-white overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-800">
          Community Desk
        </h2>
        <Link
          to="/submit"
          className="text-[11px] font-mono uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          Submit something →
        </Link>
      </header>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* Local Love */}
        <Link
          to="/community/local-love"
          className="block p-4 hover:bg-rose-50/40 transition-colors group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-rose-700">
            <Heart className="h-3 w-3" /> Local Love
          </div>
          {love ? (
            <>
              {love.subject_name && (
                <p className="text-sm font-semibold text-slate-900 mt-2 leading-snug">
                  {love.subject_name}
                </p>
              )}
              <p className="text-sm text-slate-700 mt-1 leading-relaxed line-clamp-3">
                {love.body}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                — {love.submitter_name || "A neighbor"}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 mt-2">
              Be the first to thank a neighbor.
            </p>
          )}
        </Link>

        {/* Voice */}
        <Link
          to="/community/voices"
          className="block p-4 hover:bg-slate-50 transition-colors group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-700">
            <Mic className="h-3 w-3" /> Community Voice
          </div>
          {voice ? (
            <>
              <p className="font-display text-base text-slate-900 mt-2 leading-snug group-hover:underline decoration-slate-400 underline-offset-2">
                {voice.title}
              </p>
              {voice.excerpt && (
                <p className="text-sm text-slate-700 mt-1 leading-relaxed line-clamp-2">
                  {voice.excerpt}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-2">
                — {voice.community_authors?.display_name || "The Brief Editors"}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 mt-2">
              First essays coming soon.{" "}
              <span className="underline">Pitch us</span>.
            </p>
          )}
        </Link>
      </div>

      {/* Stats strip */}
      <div className="px-4 py-2.5 bg-stone-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider text-slate-600">
          <span>
            <strong className="text-slate-900">{stats?.submissions ?? "—"}</strong>{" "}
            contributions
          </span>
          <span>
            <strong className="text-slate-900">{stats?.published ?? "—"}</strong>{" "}
            published
          </span>
          <span className="hidden sm:inline">
            <strong className="text-slate-900">{stats?.businesses ?? "—"}</strong>{" "}
            locals featured
          </span>
        </div>
        <Link
          to="/submit"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-900 hover:underline"
        >
          <PenSquare className="h-3 w-3" /> Add yours
        </Link>
      </div>
    </section>
  );
}