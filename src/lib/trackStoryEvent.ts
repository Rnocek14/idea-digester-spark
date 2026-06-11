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
  entityType: "content_queue" | "business_story" | "history_entry" | "event" | "incident";
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