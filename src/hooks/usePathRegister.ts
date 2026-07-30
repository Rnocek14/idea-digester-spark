import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// The walker's passport lives in localStorage, not in an account. Requiring a
// signup at the trailhead would kill the feature before the first stop; the
// token is the only credential, and every write goes through the rate-limited
// `path-register` edge function on the service role.
const TOKEN_KEY = "shorePathRegister.claimToken";
// Stops recorded while offline (no signal in the coves — the guide page says so).
// Flushed on the next successful call.
const PENDING_KEY = "shorePathRegister.pendingVisits";

export type Verification = "verified" | "imported" | "self_reported";
export type SeasonBucket = "spring" | "summer" | "fall" | "winter";
export type CrowdLevel = "empty" | "some" | "busy";
export type GroupSizeBand = "solo" | "pair" | "small" | "large";

export type RegisterEntry = {
  tier: "loop" | "four_seasons";
  entry_number: number;
  display_name: string | null;
  home_town: string | null;
  completed_at: string;
  days_elapsed: number | null;
  verification: Verification;
  certificate_code?: string;
};

export type WalkerProfile = {
  display_name: string | null;
  home_town: string | null;
  is_public: boolean;
};

export type RegisterProgress = {
  stops_visited: number;
  stops_total: number;
  visited_stop_ids: string[];
  loop_complete: boolean;
  verification: Verification;
  first_visit_at: string | null;
  last_visit_at: string | null;
  days_elapsed: number | null;
  seasons_completed: SeasonBucket[];
  season_stop_counts: Record<SeasonBucket, number>;
  four_seasons_complete: boolean;
  legs: Array<{ orderIndex: number; stopsTotal: number; stopsVisited: number; complete: boolean }>;
  legs_completed: number;
};

type PendingVisit = {
  stop_slug: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  /** Groups the stops of one outing so a single crowd answer covers them all. */
  session_id?: string | null;
};

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch { /* private browsing — the walk still works, it just won't persist */ }
}

/**
 * A walk session id, minted on the first stop of an outing and reused for the
 * rest of it. Kept in sessionStorage rather than localStorage so closing the tab
 * ends the walk — otherwise a stop logged in October would be filed under a
 * session from July and inherit its crowd answer.
 */
const SESSION_KEY = "shorePathRegister.sessionId";

function currentSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function readPending(): PendingVisit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingVisit[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-40)));
  } catch { /* ignore */ }
}

type InvokeResult = {
  success?: boolean;
  claim_token?: string;
  walker?: WalkerProfile;
  progress?: RegisterProgress;
  entries?: RegisterEntry[];
  newly_earned?: RegisterEntry[];
  error?: string;
  reason?: string;
  distance_m?: number | null;
};

async function invoke(body: Record<string, unknown>): Promise<InvokeResult> {
  const { data, error } = await supabase.functions.invoke("path-register", { body });
  if (error) {
    // A non-2xx carries the useful message in the response body, not in error.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const parsed = await ctx.json().catch(() => null);
      if (parsed?.error) return parsed as InvokeResult;
    }
    return { error: error.message || "Something went wrong." };
  }
  return (data ?? {}) as InvokeResult;
}

/**
 * The walker's side of the register: their passport token, their progress, and
 * the numbers they've earned.
 *
 * `recordVisit` is deliberately fire-and-forget from the caller's point of view —
 * it never throws, because a failed write must not interrupt a walk. Stops
 * recorded with no signal queue locally and flush on the next call.
 */
export function usePathRegister() {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [walker, setWalker] = useState<WalkerProfile | null>(null);
  const [progress, setProgress] = useState<RegisterProgress | null>(null);
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [newlyEarned, setNewlyEarned] = useState<RegisterEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(() => readPending().length);
  // Set to the session id once a stop lands, so the crowd question is only ever
  // asked of someone who actually just walked somewhere.
  const [conditionsPrompt, setConditionsPrompt] = useState<string | null>(null);

  // Guards a StrictMode double-mount from minting two passports.
  const claiming = useRef(false);

  const applyResult = useCallback((result: InvokeResult) => {
    if (result.walker) setWalker(result.walker);
    if (result.progress) setProgress(result.progress);
    if (result.entries) setEntries(result.entries);
    if (result.newly_earned && result.newly_earned.length > 0) {
      // Announce the highest tier earned; four_seasons outranks loop.
      const best = result.newly_earned.find((e) => e.tier === "four_seasons") ?? result.newly_earned[0];
      setNewlyEarned(best);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const t = readToken();
    if (!t) return;
    setIsLoading(true);
    setError(null);
    const result = await invoke({ action: "progress", claim_token: t });
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    applyResult(result);
  }, [applyResult]);

  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);

  /** Start a passport. Returns the token, or null if it could not be created. */
  const startPassport = useCallback(async (profile?: Partial<WalkerProfile>): Promise<string | null> => {
    const existing = readToken();
    if (existing) return existing;
    if (claiming.current) return null;
    claiming.current = true;
    setIsLoading(true);
    setError(null);

    const result = await invoke({
      action: "claim",
      display_name: profile?.display_name ?? null,
      home_town: profile?.home_town ?? null,
      is_public: profile?.is_public === true,
    });

    setIsLoading(false);
    claiming.current = false;

    if (result.error || !result.claim_token) {
      setError(result.error ?? "Could not start a passport.");
      return null;
    }
    writeToken(result.claim_token);
    setToken(result.claim_token);
    if (result.walker) setWalker(result.walker);
    return result.claim_token;
  }, []);

  /**
   * Record an arrival. The server decides whether the coordinates prove it, so a
   * rejected visit is a normal outcome rather than an error worth surfacing
   * mid-walk.
   */
  const recordVisit = useCallback(
    async (visit: PendingVisit): Promise<void> => {
      let t = readToken();
      if (!t) {
        t = await startPassport();
        if (!t) {
          // No passport and no network: hold the stop and try again later.
          const queued = [...readPending(), visit];
          writePending(queued);
          setPendingCount(queued.length);
          return;
        }
      }

      const sessionId = visit.session_id ?? currentSessionId();
      const queue = [...readPending(), { ...visit, session_id: sessionId }];
      const unsent: PendingVisit[] = [];
      let last: InvokeResult | null = null;

      for (const item of queue) {
        const result = await invoke({ action: "visit", claim_token: t, ...item });
        // 422 means "you weren't there" — a settled answer, so stop retrying it.
        // Anything else (offline, 5xx) is worth another attempt later.
        const settled = !result.error || result.reason != null;
        if (!settled) {
          unsent.push(item);
          continue;
        }
        if (!result.error) last = result;
      }

      writePending(unsent);
      setPendingCount(unsent.length);
      if (last) applyResult(last);
      // A stop landed, so there is now a session worth asking about.
      if (last) setConditionsPrompt(sessionId || null);
    },
    [applyResult, startPassport],
  );

  /**
   * The one-tap conditions answer, applied to every stop of this outing. Silent
   * on failure: this is a nice-to-have on top of a walk, not the walk.
   */
  const recordConditions = useCallback(
    async (answer: { crowd_level?: CrowdLevel; group_size_band?: GroupSizeBand }): Promise<void> => {
      const t = readToken();
      const sessionId = conditionsPrompt ?? currentSessionId();
      if (!t || !sessionId) return;
      setConditionsPrompt(null);
      await invoke({ action: "conditions", claim_token: t, session_id: sessionId, ...answer });
    },
    [conditionsPrompt],
  );

  const dismissConditionsPrompt = useCallback(() => setConditionsPrompt(null), []);

  const updateProfile = useCallback(
    async (patch: Partial<WalkerProfile>): Promise<boolean> => {
      const t = readToken();
      if (!t) return false;
      setIsLoading(true);
      setError(null);
      const result = await invoke({ action: "profile", claim_token: t, ...patch });
      setIsLoading(false);
      if (result.error) {
        setError(result.error);
        return false;
      }
      if (result.walker) setWalker(result.walker);
      // Publishing rewrites the register entries, so pull them fresh.
      await refresh();
      return true;
    },
    [refresh],
  );

  const dismissNewlyEarned = useCallback(() => setNewlyEarned(null), []);

  return {
    hasPassport: token != null,
    walker,
    progress,
    entries,
    newlyEarned,
    pendingCount,
    isLoading,
    error,
    /** Non-null when a stop has just landed and conditions haven't been answered. */
    conditionsPrompt,
    startPassport,
    recordVisit,
    recordConditions,
    updateProfile,
    refresh,
    dismissNewlyEarned,
    dismissConditionsPrompt,
  };
}
