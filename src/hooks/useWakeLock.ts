import { useEffect } from "react";

// The Screen Wake Lock API is still absent from this project's DOM lib typings
// and unsupported on some of the browsers walkers actually use, so it is typed
// structurally here rather than with `any` — narrow enough that a typo in
// `request` or `release` is still a compile error.
type WakeLockSentinelLike = { release?: () => Promise<void> | void };
type WakeLockLike = { request?: (type: "screen") => Promise<WakeLockSentinelLike> };

/** Keeps the screen awake while active. Silently no-ops on unsupported browsers. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
        if (wl?.request) {
          sentinel = await wl.request("screen");
        }
      } catch {
        // ignore — not critical
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { sentinel?.release?.(); } catch { /* ignore */ }
    };
  }, [active]);
}