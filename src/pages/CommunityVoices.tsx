import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mic } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  published_at: string | null;
  community_authors: { display_name: string; slug: string } | null;
};

export default function CommunityVoices() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["community-voices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, slug, title, excerpt, category, published_at, community_authors!author_id(display_name, slug)")
        .eq("status", "published")
        .neq("category", "throwback")
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as unknown as Post[];
    },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-slate-900 tracking-tight flex items-center gap-2">
            <Mic className="h-7 w-7 text-slate-700" /> Community Voices
          </h1>
          <p className="text-slate-600 mt-2 text-sm leading-relaxed max-w-2xl">
            Essays, memories, and notes from people who live, work, and run businesses
            around Lake Geneva. Real bylines, edited, never anonymous.
          </p>
        </header>

        {isLoading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : data.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center">
            <h2 className="font-display text-xl text-slate-900">Want to write for the Brief?</h2>
            <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto leading-relaxed">
              We're opening Voices to neighbors with something to say —
              a business owner's take, a memory worth keeping, a quiet opinion on the lake.
              Pitch us a paragraph and we'll be in touch.
            </p>
            <Link to="/submit" className="inline-block mt-5">
              <Button>Pitch us</Button>
            </Link>
            <p className="text-[11px] text-slate-500 mt-4">
              Use the Tip form for now. We'll reply.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((p) => (
              <article key={p.id} className="rounded-md border border-slate-200 bg-white p-5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {p.category.replace(/_/g, " ")}
                </span>
                <h2 className="font-display text-xl text-slate-900 mt-1">{p.title}</h2>
                {p.excerpt && (
                  <p className="text-sm text-slate-700 mt-2 leading-relaxed">{p.excerpt}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-3">
                  — {p.community_authors?.display_name || "The Brief Editors"}
                  {p.published_at
                    ? ` · ${new Date(p.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}