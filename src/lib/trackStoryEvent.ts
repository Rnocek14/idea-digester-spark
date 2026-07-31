import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";

export type ContentPillar =
  | "news"
  | "business"
  | "history"
  | "events"
  | "community"
  | "schools"
  | "civic"
  | "other";

export type StoryEventType =
  | "homepage_impression"
  | "homepage_click"
  | "detail_view"
  | "newsletter_click"
  | "detail_read_complete";

const SESSION_KEY = "lg_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = (crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

/**
 * Derive a content pillar from a content_queue category string.
 * Returns 'other' when we can't confidently classify.
 */
export function pillarFromCategory(category?: string | null): ContentPillar {
  if (!category) return "news";
  const c = category.toLowerCase();
  if (c.includes("event")) return "events";
  if (c.includes("school") || c.includes("education")) return "schools";
  if (c.includes("community") || c.includes("voice")) return "community";
  if (c.includes("business") || c.includes("dining") || c.includes("restaurant")) return "business";
  if (c.includes("civic") || c.includes("government") || c.includes("police") || c.includes("fire")) return "civic";
  if (c.includes("history") || c.includes("legacy")) return "history";
  return "news";
}

type TrackArgs = {
  pillar: ContentPillar;
  eventType: StoryEventType;
  entityType: "content_queue" | "business_story" | "history_entry" | "event" | "incident" | "guide";
  entityId?: string | null;
  slug?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Log a single reader-engagement event. Fire-and-forget; never throws.
 */
export async function trackStoryEvent(args: TrackArgs): Promise<void> {
  try {
    const path = typeof window !== "undefined" ? window.location.pathname : null;
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    await supabase.from("story_events").insert([
      {
        pillar: args.pillar,
        event_type: args.eventType,
        entity_type: args.entityType,
        entity_id: args.entityId ?? undefined,
        slug: args.slug ?? undefined,
        session_id: getSessionId(),
        path: path ?? undefined,
        referrer: referrer ?? undefined,
        metadata: JSON.parse(JSON.stringify(args.metadata ?? {})),
      },
    ]);
  } catch {
    /* swallow */
  }
}

/** Read this browser's session id (used for returning-visitor diagnostics). */
export function currentSessionId(): string {
  return getSessionId();
}

/**
 * Traffic we must never count as a reader.
 *
 * scripts/prerender.mjs drives all 39 routes through a real Chromium on every build.
 * Without this guard each deploy would manufacture 39 page views, and the single number
 * this whole file exists to answer — "is anyone actually reading this?" — would be
 * produced by our own CI. Headless drivers and declared crawlers are excluded on the
 * same principle: under-counting real readers is recoverable, reporting traffic that
 * isn't there is not.
 */
function isNonReader(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (!ua) return true;
  if (/Prerender|HeadlessChrome|Playwright|Puppeteer/i.test(ua)) return true;
  if (/bot|crawler|spider|slurp|facebookexternalhit|embedly|curl|wget|python-requests|node-fetch/i.test(ua)) return true;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  return false;
}

const READ_DWELL_MS = 20_000;
const READ_SCROLL_RATIO = 0.5;

/**
 * Record that a page was opened, and separately that it was plausibly READ.
 *
 *   detail_view           once on mount — "a browser opened this URL"
 *   detail_read_complete  only after READ_DWELL_MS *and* scrolling past half the page —
 *                         "a human very likely read this"
 *
 * The ratio between those two counts is the most honest bot-versus-human signal
 * available without a third-party vendor: automated traffic reliably produces the first
 * and almost never the second. A single number for "views" would flatter us; two
 * numbers tell the truth.
 *
 * The privacy policy already describes exactly this — anonymous aggregate signals under
 * a random session id, no profile, no account. Until now it was promised and not built.
 */
export function usePageView(args: {
  pillar: ContentPillar;
  entityType: TrackArgs["entityType"];
  entityId?: string | null;
  slug?: string | null;
  enabled?: boolean;
}): void {
  const { pillar, entityType, entityId, slug, enabled = true } = args;
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || isNonReader()) return;

    // StrictMode double-invokes effects in dev; key on what we are recording so a
    // remount of the same page cannot double-count it.
    const key = `${entityType}:${entityId ?? slug ?? window.location.pathname}`;
    if (seen.current === key) return;
    seen.current = key;

    void trackStoryEvent({ pillar, eventType: "detail_view", entityType, entityId, slug });

    let deepEnough = false;
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      // A page shorter than the viewport cannot be scrolled — count it as read-through.
      if (scrollable <= 0) { deepEnough = true; return; }
      if (window.scrollY / scrollable >= READ_SCROLL_RATIO) deepEnough = true;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const timer = window.setTimeout(() => {
      if (!deepEnough) return;
      void trackStoryEvent({ pillar, eventType: "detail_read_complete", entityType, entityId, slug });
    }, READ_DWELL_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pillar, entityType, entityId, slug, enabled]);
}
