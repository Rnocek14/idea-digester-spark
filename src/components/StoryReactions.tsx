import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThumbsUp, Sparkles, ThumbsDown } from "lucide-react";
import { getSessionId } from "@/lib/sessionId";
import { cn } from "@/lib/utils";

type ReactionKey = "helpful" | "more_like_this" | "not_for_me";

const OPTIONS: { key: ReactionKey; label: string; icon: typeof ThumbsUp }[] = [
  { key: "helpful", label: "Helpful", icon: ThumbsUp },
  { key: "more_like_this", label: "More like this", icon: Sparkles },
  { key: "not_for_me", label: "Not for me", icon: ThumbsDown },
];

export function StoryReactions({ storyId }: { storyId: string }) {
  const [counts, setCounts] = useState<Record<ReactionKey, number>>({
    helpful: 0,
    more_like_this: 0,
    not_for_me: 0,
  });
  const [mine, setMine] = useState<ReactionKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const sid = getSessionId();
      const [{ data: all }, { data: own }] = await Promise.all([
        supabase.from("story_reactions").select("reaction").eq("story_id", storyId),
        supabase
          .from("story_reactions")
          .select("reaction")
          .eq("story_id", storyId)
          .eq("session_id", sid)
          .maybeSingle(),
      ]);
      if (cancel) return;
      const next: Record<ReactionKey, number> = { helpful: 0, more_like_this: 0, not_for_me: 0 };
      (all || []).forEach((r: any) => {
        if (r.reaction in next) next[r.reaction as ReactionKey] += 1;
      });
      setCounts(next);
      setMine((own?.reaction as ReactionKey) ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [storyId]);

  const choose = async (key: ReactionKey) => {
    if (busy) return;
    setBusy(true);
    const sid = getSessionId();
    const previous = mine;

    // Optimistic
    setCounts((c) => {
      const n = { ...c };
      if (previous && previous !== key) n[previous] = Math.max(0, n[previous] - 1);
      if (previous === key) {
        n[key] = Math.max(0, n[key] - 1);
      } else {
        n[key] = n[key] + 1;
      }
      return n;
    });
    const toggling = previous === key;
    setMine(toggling ? null : key);

    try {
      if (toggling) {
        await supabase
          .from("story_reactions")
          .delete()
          .eq("story_id", storyId)
          .eq("session_id", sid);
      } else {
        await supabase
          .from("story_reactions")
          .upsert(
            { story_id: storyId, session_id: sid, reaction: key },
            { onConflict: "story_id,session_id" }
          );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 pt-6 border-t border-slate-200">
      <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
        Was this useful?
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ key, label, icon: Icon }) => {
          const selected = mine === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors min-h-[44px]",
                selected
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-stone-50"
              )}
              aria-pressed={selected}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {counts[key] > 0 && (
                <span className={cn("text-xs", selected ? "text-white/80" : "text-slate-500")}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}