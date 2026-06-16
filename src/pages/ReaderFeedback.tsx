import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { storyPath } from "@/lib/slug";

interface Suggestion {
  id: string;
  message: string;
  email: string | null;
  page_path: string | null;
  status: string;
  created_at: string;
}

interface ReactionRow {
  story_id: string;
  reaction: string;
  created_at: string;
}

interface StoryRollup {
  story_id: string;
  title: string | null;
  helpful: number;
  more_like_this: number;
  not_for_me: number;
  total: number;
}

const ReaderFeedback = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reactions, setReactions] = useState<StoryRollup[]>([]);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"new" | "all">("new");

  const loadSuggestions = async () => {
    let q = supabase
      .from("reader_suggestions")
      .select("id,message,email,page_path,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "new") q = q.eq("status", "new");
    const { data, error } = await q;
    if (error) {
      toast.error("Couldn't load suggestions");
      return;
    }
    setSuggestions(data || []);
  };

  const loadReactions = async () => {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: rx } = await supabase
      .from("story_reactions")
      .select("story_id,reaction,created_at")
      .gte("created_at", since);
    const grouped = new Map<string, StoryRollup>();
    (rx || []).forEach((r: ReactionRow) => {
      const cur =
        grouped.get(r.story_id) ||
        ({ story_id: r.story_id, title: null, helpful: 0, more_like_this: 0, not_for_me: 0, total: 0 } as StoryRollup);
      if (r.reaction === "helpful") cur.helpful++;
      else if (r.reaction === "more_like_this") cur.more_like_this++;
      else if (r.reaction === "not_for_me") cur.not_for_me++;
      cur.total = cur.helpful + cur.more_like_this + cur.not_for_me;
      grouped.set(r.story_id, cur);
    });
    const ids = Array.from(grouped.keys());
    if (ids.length) {
      const { data: stories } = await supabase
        .from("content_queue")
        .select("id,title")
        .in("id", ids);
      (stories || []).forEach((s: any) => {
        const g = grouped.get(s.id);
        if (g) g.title = s.title;
      });
    }
    const list = Array.from(grouped.values()).sort(
      (a, b) => b.more_like_this + b.helpful - (a.more_like_this + a.helpful)
    );
    setReactions(list);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSuggestions(), loadReactions()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, windowDays]);

  const setStatus = async (id: string, status: "read" | "archived" | "new") => {
    const { error } = await supabase.from("reader_suggestions").update({ status }).eq("id", id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    toast.success(`Marked ${status}`);
    loadSuggestions();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reader Feedback</h1>
        <p className="text-sm text-slate-600 mt-1">
          What readers are telling us — suggestions and per-story reactions.
        </p>
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="reactions">Story reactions</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button
              variant={filter === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("new")}
            >
              New
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : suggestions.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">No suggestions yet.</Card>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <Card key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge variant={s.status === "new" ? "default" : "outline"}>{s.status}</Badge>
                      <span>{format(new Date(s.created_at), "MMM d, h:mm a")}</span>
                      {s.page_path && <span className="font-mono">{s.page_path}</span>}
                    </div>
                    <div className="flex gap-2">
                      {s.status !== "read" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "read")}>
                          Mark read
                        </Button>
                      )}
                      {s.status !== "archived" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "archived")}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{s.message}</p>
                  {s.email && (
                    <p className="text-xs text-slate-500">
                      Reply to:{" "}
                      <a href={`mailto:${s.email}`} className="text-blue-700 hover:underline">
                        {s.email}
                      </a>
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reactions" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button
              variant={windowDays === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setWindowDays(7)}
            >
              Last 7 days
            </Button>
            <Button
              variant={windowDays === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setWindowDays(30)}
            >
              Last 30 days
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : reactions.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">No reactions in this window yet.</Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">Story</th>
                    <th className="text-right px-4 py-2">Helpful</th>
                    <th className="text-right px-4 py-2">More like this</th>
                    <th className="text-right px-4 py-2">Not for me</th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.map((r) => (
                    <tr key={r.story_id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {r.title ? (
                          <Link
                            to={storyPath(r.story_id, r.title)}
                            className="text-slate-800 hover:text-blue-700"
                          >
                            {r.title}
                          </Link>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">{r.story_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="text-right px-4 py-2 text-emerald-700 font-medium">{r.helpful}</td>
                      <td className="text-right px-4 py-2 text-blue-700 font-medium">{r.more_like_this}</td>
                      <td className="text-right px-4 py-2 text-slate-500">{r.not_for_me}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReaderFeedback;