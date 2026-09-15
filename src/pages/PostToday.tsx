import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Download,
  CircleCheck,
  SkipForward,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Post Today — the queue's manual half.
 *
 * There is no Meta API access yet, so Facebook and Instagram posts cannot be
 * published by a cron. They used to be marked "simulated" and discarded, which
 * meant the pipeline drafted posts for the two platforms the readers actually
 * use and then reached nobody. They now stop here instead.
 *
 * This screen is built for a phone, because that is where the operator is when
 * they publish: everything needed for one post is inside one card — the image
 * to save, the text to copy, the app to open, and the button that clears it —
 * with no horizontal scrolling and no dialogs to dismiss.
 */

type ManualPost = {
  id: string;
  platform: string;
  post_text: string;
  image_url: string | null;
  generated_image_url: string | null;
  scheduled_for: string;
  metadata: Record<string, unknown> | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
};

// Kept in step with composerUrl() in supabase/functions/_shared/socialRouting.ts.
const COMPOSER_URL: Record<string, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  x: "https://x.com/compose/post",
};

function formatSlot(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

function PostCard({ post }: { post: ManualPost }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const image = post.generated_image_url || post.image_url;
  const composer = COMPOSER_URL[post.platform];
  const isOverdue = new Date(post.scheduled_for) < new Date();

  const resolve = useMutation({
    mutationFn: async (outcome: "posted" | "skipped") => {
      const { error } = await supabase
        .from("post_queue")
        .update(
          outcome === "posted"
            ? {
                status: "sent",
                posted_manually: true,
                sent_at: new Date().toISOString(),
              }
            : {
                status: "skipped",
                error_message: "Skipped by operator from Post Today",
              },
        )
        .eq("id", post.id);
      if (error) throw error;
      return outcome;
    },
    onSuccess: (outcome) => {
      qc.invalidateQueries({ queryKey: ["manual-posts"] });
      toast.success(outcome === "posted" ? "Marked as posted" : "Skipped");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the post"),
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(post.post_text);
      setCopied(true);
      toast.success("Caption copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text and copy it by hand");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{PLATFORM_LABEL[post.platform] || post.platform}</Badge>
          <span className="text-sm text-muted-foreground">{formatSlot(post.scheduled_for)}</span>
          {isOverdue && (
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              past its slot
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {image && (
          <div className="space-y-2">
            <img
              src={image}
              alt=""
              loading="lazy"
              className="w-full rounded-lg border object-cover"
            />
            {/* Posting from a phone means attaching a file, so the image has to
                be saveable — a preview alone is not enough to post with. */}
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <a href={image} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4 mr-2" />
                Save image
              </a>
            </Button>
          </div>
        )}

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.post_text}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied" : "Copy caption"}
          </Button>
          {composer && (
            <Button variant="outline" asChild>
              <a href={composer} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open {PLATFORM_LABEL[post.platform] || post.platform}
              </a>
            </Button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 pt-1">
          <Button onClick={() => resolve.mutate("posted")} disabled={resolve.isPending}>
            {resolve.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CircleCheck className="h-4 w-4 mr-2" />
            )}
            Mark as posted
          </Button>
          <Button
            variant="ghost"
            onClick={() => resolve.mutate("skipped")}
            disabled={resolve.isPending}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip this one
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PostToday = () => {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["manual-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_queue")
        .select("id, platform, post_text, image_url, generated_image_url, scheduled_for, metadata")
        .eq("status", "awaiting_manual")
        .order("scheduled_for", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data || []) as ManualPost[];
    },
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Post Today</h1>
        <p className="text-muted-foreground mt-1">
          Written and waiting on you. Facebook and Instagram have no API access yet,
          so these are published by hand — copy, post, then mark them done.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the queue…
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Couldn't load the queue: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && posts?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Nothing waiting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Everything scheduled has been posted or skipped. New posts appear here as
            the queue prepares them.
          </CardContent>
        </Card>
      )}

      {posts?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

export default PostToday;
