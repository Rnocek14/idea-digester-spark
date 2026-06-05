import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Entry = {
  id: string;
  category: "people" | "places" | "moments" | null;
  body: string;
  subject_name: string | null;
  submitter_name: string | null;
  submitter_town: string | null;
  created_at: string;
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "people", label: "People" },
  { value: "places", label: "Places" },
  { value: "moments", label: "Moments" },
] as const;

export default function CommunityLocalLove() {
  const [filter, setFilter] = useState<string>("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["local-love", filter],
    queryFn: async () => {
      let q = supabase
        .from("community_submissions")
        .select("id, category, body, subject_name, submitter_name, submitter_town, created_at")
        .eq("kind", "local_love")
        .in("status", ["approved", "published"])
        .order("created_at", { ascending: false })
        .limit(120);
      if (filter !== "all") q = q.eq("category", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Entry[];
    },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-slate-900 tracking-tight flex items-center gap-2">
              <Heart className="h-7 w-7 text-rose-500" /> Local Love
            </h1>
            <p className="text-slate-600 mt-2 text-sm max-w-2xl leading-relaxed">
              Short shout-outs from neighbors — people, places, and moments worth thanking.
              Every note is reviewed before it lands here.
            </p>
          </div>
          <Link to="/submit">
            <Button className="bg-rose-600 hover:bg-rose-700">Add yours</Button>
          </Link>
        </header>

        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                filter === f.value
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : data.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-700">Nothing here yet.</p>
            <p className="text-slate-500 text-sm mt-1">Be the first to thank a neighbor.</p>
            <Link to="/submit" className="inline-block mt-4">
              <Button className="bg-rose-600 hover:bg-rose-700">Send some love</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.map((e) => (
              <article
                key={e.id}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              >
                {e.category && (
                  <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                    {e.category}
                  </span>
                )}
                {e.subject_name && (
                  <p className="text-sm font-semibold text-slate-900 mt-2">{e.subject_name}</p>
                )}
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{e.body}</p>
                <p className="text-[11px] text-slate-500 mt-3">
                  — {e.submitter_name || "A neighbor"}
                  {e.submitter_town ? `, ${e.submitter_town}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}