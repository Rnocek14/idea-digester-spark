import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PICK_TAGS = [
  { value: "worth_leaving_the_house_for", label: "Worth leaving the house for" },
  { value: "low_key_weekend", label: "Low-key weekend" },
  { value: "good_for_visitors", label: "Good for visitors" },
  { value: "locals_will_care", label: "Locals will care" },
] as const;

type Props = {
  story: {
    id: string;
    title: string;
    featured_in_later?: boolean | null;
    editorial_pick_reason?: string | null;
    featured_rank?: number | null;
    pick_tag?: string[] | null;
  };
};

export default function FeatureInLaterButton({ story }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [featured, setFeatured] = useState(!!story.featured_in_later);
  const [reason, setReason] = useState(story.editorial_pick_reason || "");
  const [rank, setRank] = useState<number | "">(story.featured_rank ?? "");
  const [tags, setTags] = useState<string[]>(story.pick_tag || []);

  useEffect(() => {
    setFeatured(!!story.featured_in_later);
    setReason(story.editorial_pick_reason || "");
    setRank(story.featured_rank ?? "");
    setTags(story.pick_tag || []);
  }, [story.id, story.featured_in_later, story.editorial_pick_reason, story.featured_rank, story.pick_tag]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_queue")
        .update({
          featured_in_later: featured,
          editorial_pick_reason: featured ? reason || null : null,
          featured_rank: featured && rank !== "" ? Number(rank) : null,
          pick_tag: tags,
        })
        .eq("id", story.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(featured ? "Featured in Later" : "Saved");
      qc.invalidateQueries({ queryKey: ["content-queue"] });
      qc.invalidateQueries({ queryKey: ["later-featured"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const toggleTag = (v: string) => {
    setTags((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Feature in Later / Picks">
          <Sparkles
            className={cn(
              "h-4 w-4",
              story.featured_in_later ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Editorial controls</h4>
            <p className="text-xs text-muted-foreground truncate">{story.title}</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={featured}
              onCheckedChange={(v) => setFeatured(!!v)}
            />
            Feature in Later
          </label>

          {featured && (
            <>
              <div>
                <Label className="text-xs">Reason (shown on homepage)</Label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="One line on why this matters"
                />
              </div>
              <div>
                <Label className="text-xs">Rank (1–3)</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRank(rank === n ? "" : n)}
                      className={`w-8 h-8 rounded border text-sm ${
                        rank === n
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white border-slate-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Brief Picks tags</Label>
            <div className="space-y-1 mt-1">
              {PICK_TAGS.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={tags.includes(t.value)}
                    onCheckedChange={() => toggleTag(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}