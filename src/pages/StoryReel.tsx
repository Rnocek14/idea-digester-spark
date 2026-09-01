import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, ChevronUp, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageMeta } from "@/components/PageMeta";
import { useLocalFeed } from "@/hooks/useLocalFeed";
import { storyPath } from "@/lib/slug";
import {
  isStorySaved,
  listSavedStories,
  subscribeSavedStories,
  toggleSavedStory,
  type SavedStory,
} from "@/lib/savedStories";
import { trackStoryEvent, pillarFromCategory } from "@/lib/trackStoryEvent";

const GEO_PILL: Record<number, { label: string; className: string }> = {
  1: { label: "Lake Geneva", className: "bg-blue-500/90 text-white" },
  2: { label: "Walworth", className: "bg-amber-500/90 text-white" },
  0: { label: "Wisconsin", className: "bg-slate-500/90 text-white" },
};

const relativeTime = (iso?: string | null) => {
  if (!iso) return null;
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const d = Math.floor(diffH / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
};

const toSaved = (story: any): Omit<SavedStory, "savedAt"> => ({
  id: story.id,
  title: story.title,
  summary: story.summary ?? null,
  imageUrl: story.image_url ?? null,
  category: story.category ?? null,
  geoTier: story.geo_tier ?? null,
  path: storyPath(story.id, story.title),
});

const StoryReel = () => {
  const navigate = useNavigate();
  const { stories, storiesLoading } = useLocalFeed();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());

  const reelStories = useMemo(() => (stories || []).slice(0, 30), [stories]);

  useEffect(() => {
    setSavedIds(new Set(listSavedStories().map((s) => s.id)));
    return subscribeSavedStories((items) => setSavedIds(new Set(items.map((s) => s.id))));
  }, []);

  // Track which card is on screen — both for the progress rail and for the
  // impression event, so reel engagement lands in Content Analytics.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
          const story = reelStories[idx];
          if (story && !seenRef.current.has(story.id)) {
            seenRef.current.add(story.id);
            void trackStoryEvent({
              pillar: pillarFromCategory(story.category),
              eventType: "homepage_impression",
              entityType: "content_queue",
              entityId: story.id,
              metadata: { surface: "reel", position: idx },
            });
          }
        });
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-reel-card]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reelStories]);

  const handleSave = (story: any) => {
    const nowSaved = toggleSavedStory(toSaved(story));
    toast.success(nowSaved ? "Saved to your list" : "Removed from your list", {
      action: nowSaved ? { label: "View", onClick: () => navigate("/saved") } : undefined,
    });
    if (nowSaved) {
      void trackStoryEvent({
        pillar: pillarFromCategory(story.category),
        eventType: "homepage_click",
        entityType: "content_queue",
        entityId: story.id,
        metadata: { surface: "reel", action: "save" },
      });
    }
  };

  const openStory = (story: any) => {
    void trackStoryEvent({
      pillar: pillarFromCategory(story.category),
      eventType: "homepage_click",
      entityType: "content_queue",
      entityId: story.id,
      metadata: { surface: "reel", action: "open" },
    });
    navigate(storyPath(story.id, story.title));
  };

  // Horizontal flick = save. Vertical paging is handled by CSS scroll-snap, so
  // we only claim the gesture once it is clearly sideways.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent, story: any) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) handleSave(story);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white">
      <PageMeta
        title="Swipe the Brief | Lake Geneva Brief"
        description="Flick through today's Lake Geneva stories one at a time."
        path="/reel"
        noindex
      />

      {/* Top chrome */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-slate-900/90 to-transparent">
        <Link
          to="/"
          aria-label="Close the reel and return home"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/60"
        >
          <X className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold tracking-wide">Swipe the Brief</span>
        <Link
          to="/saved"
          aria-label="View your saved stories"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/60"
        >
          <Bookmark className="h-5 w-5" />
        </Link>
      </div>

      {/* Progress rail */}
      {reelStories.length > 0 && (
        <div className="absolute right-1.5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1 sm:flex">
          {reelStories.map((s: any, i: number) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === activeIndex ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth motion-reduce:scroll-auto"
      >
        {storiesLoading && (
          <div className="flex h-full items-center justify-center text-slate-300">Loading the brief…</div>
        )}

        {!storiesLoading &&
          reelStories.map((story: any, index: number) => {
            const pill = GEO_PILL[(story.geo_tier ?? 0) as number];
            const saved = savedIds.has(story.id);
            return (
              <section
                key={story.id}
                data-reel-card
                data-index={index}
                className="relative flex h-full snap-start snap-always flex-col justify-end"
                onTouchStart={onTouchStart}
                onTouchEnd={(e) => onTouchEnd(e, story)}
              >
                {story.image_url && (
                  <img
                    src={story.image_url}
                    alt={story.title}
                    loading={index < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/20" />

                <div className="relative z-10 px-5 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    {pill && <span className={`rounded-full px-2.5 py-1 font-semibold ${pill.className}`}>{pill.label}</span>}
                    {story.category && (
                      <span className="rounded-full bg-white/15 px-2.5 py-1 capitalize">
                        {String(story.category).replace("_", " ")}
                      </span>
                    )}
                    {relativeTime(story.created_at) && (
                      <span className="text-slate-300">{relativeTime(story.created_at)}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openStory(story)}
                    className="block text-left"
                  >
                    <h2 className="text-2xl font-bold leading-tight">{story.title}</h2>
                    {story.summary && (
                      <p className="mt-3 line-clamp-4 text-[15px] leading-relaxed text-slate-200">{story.summary}</p>
                    )}
                  </button>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openStory(story)}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 text-sm font-semibold text-slate-900"
                    >
                      Read the story <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(story)}
                      aria-pressed={saved}
                      aria-label={saved ? "Remove from saved stories" : "Save this story"}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10"
                    >
                      {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                    </button>
                    {story.source?.name && (
                      <span className="truncate text-xs text-slate-300">{story.source.name}</span>
                    )}
                  </div>

                  {index === 0 && (
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-300 motion-safe:animate-pulse">
                      <ChevronUp className="h-3.5 w-3.5" /> Swipe up for the next story · swipe right to save
                    </p>
                  )}
                </div>
              </section>
            );
          })}

        {!storiesLoading && (
          <section className="flex h-full snap-start flex-col items-center justify-center gap-4 px-6 text-center">
            <h2 className="text-2xl font-bold">You're caught up</h2>
            <p className="max-w-xs text-sm text-slate-300">
              That's everything local today. Here's where neighbors go next.
            </p>
            <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
              <Link
                to="/guides/lake-geneva-shore-path"
                className="flex min-h-[44px] items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-900"
              >
                Walk the Shore Path guide
              </Link>
              <Link
                to="/eats"
                className="flex min-h-[44px] items-center justify-center rounded-lg border border-white/30 px-4 text-sm font-semibold"
              >
                Where to eat this week
              </Link>
              <Link
                to="/saved"
                className="flex min-h-[44px] items-center justify-center rounded-lg border border-white/30 px-4 text-sm font-semibold"
              >
                Your saved stories
              </Link>
              <Link
                to="/#subscribe"
                className="flex min-h-[44px] items-center justify-center rounded-lg border border-white/30 px-4 text-sm font-semibold"
              >
                Get the morning email
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default StoryReel;
