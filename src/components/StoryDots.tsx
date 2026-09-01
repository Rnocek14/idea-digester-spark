import { useCallback, useEffect, useRef, useState } from "react";

export type DotStory = {
  id: string;
  title: string;
  geo_tier?: number | null;
};

// Locality palette. Shared by the reel and the homepage so the two surfaces
// can never drift: tier 1 = Lake Geneva, tier 2 = Walworth, everything else
// reads as wider Wisconsin.
export const GEO_PILL: Record<number, { label: string; className: string }> = {
  1: { label: "Lake Geneva", className: "bg-blue-500/90 text-white" },
  2: { label: "Walworth", className: "bg-amber-500/90 text-white" },
  0: { label: "Wisconsin", className: "bg-slate-500/90 text-white" },
};

const DOT_COLOR: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-amber-500",
  0: "bg-slate-400",
};

export const geoTierKey = (tier?: number | null) => (tier === 1 || tier === 2 ? tier : 0);
export const geoTierLabel = (tier?: number | null) => GEO_PILL[geoTierKey(tier)].label;

const HOLD_MS = 350;

type Props = {
  stories: DotStory[];
  activeIndex: number;
  readIds: Set<string>;
  onJump: (index: number) => void;
  /** Dark chrome (the reel) vs light chrome (the homepage). */
  tone?: "dark" | "light";
  className?: string;
};

/**
 * A dot per story in today's run. Tap to jump, press-and-hold to peek at the
 * headline. Colour carries locality, fill carries read state.
 */
export const StoryDots = ({
  stories,
  activeIndex,
  readIds,
  onJump,
  tone = "dark",
  className = "",
}: Props) => {
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearHold(), [clearHold]);

  // Keep the active dot in view on long runs.
  useEffect(() => {
    const row = rowRef.current;
    const dot = dotRefs.current[activeIndex];
    if (!row || !dot) return;
    const target = dot.offsetLeft - row.clientWidth / 2 + dot.clientWidth / 2;
    row.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeIndex, stories.length]);

  if (stories.length < 2) return null;

  const peekStory = peekIndex === null ? null : stories[peekIndex];

  const startHold = (index: number) => {
    heldRef.current = false;
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setPeekIndex(index);
    }, HOLD_MS);
  };

  const endHold = (index: number) => {
    clearHold();
    setPeekIndex(null);
    // A hold that ended on its own dot still jumps — lifting off is "go here".
    onJump(index);
    heldRef.current = false;
  };

  const cancelHold = () => {
    clearHold();
    setPeekIndex(null);
    heldRef.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? index + 1 : index - 1;
    if (next < 0 || next >= stories.length) return;
    onJump(next);
    dotRefs.current[next]?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {peekStory && (
        <div
          className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[min(20rem,85vw)] -translate-x-1/2 rounded-lg px-3 py-2 shadow-lg ${
            tone === "dark" ? "bg-slate-800 text-white" : "bg-slate-800 text-white"
          }`}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
            {geoTierLabel(peekStory.geo_tier)}
          </span>
          <span className="mt-0.5 block line-clamp-2 text-sm leading-snug">{peekStory.title}</span>
        </div>
      )}

      <div
        ref={rowRef}
        role="tablist"
        aria-label="Stories in today's brief"
        aria-orientation="horizontal"
        className="flex items-center justify-center gap-2.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stories.map((story, index) => {
          const isActive = index === activeIndex;
          const isRead = readIds.has(story.id) || index < activeIndex;
          return (
            <button
              key={story.id}
              ref={(el) => (dotRefs.current[index] = el)}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              aria-label={`Story ${index + 1} of ${stories.length}, ${geoTierLabel(story.geo_tier)}, ${story.title}`}
              onPointerDown={() => startHold(index)}
              onPointerUp={() => endHold(index)}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={(e) => onKeyDown(e, index)}
              onClick={(e) => {
                // Pointer handlers already did the work on touch/mouse; this
                // only carries keyboard activation.
                if (e.detail !== 0) return;
                onJump(index);
              }}
              className="group relative flex h-6 w-2.5 shrink-0 items-center justify-center"
            >
              <span
                className={`block rounded-full transition-all ${DOT_COLOR[geoTierKey(story.geo_tier)]} ${
                  isActive
                    ? `h-2.5 w-2.5 ring-2 ring-offset-1 ${tone === "dark" ? "ring-white/70 ring-offset-slate-900" : "ring-slate-400 ring-offset-white"}`
                    : isRead
                      ? "h-1.5 w-1.5"
                      : "h-1.5 w-1.5 opacity-30"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StoryDots;
