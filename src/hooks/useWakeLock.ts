import { useEffect } from "react";

/** Keeps the screen awake while active. Silently no-ops on unsupported browsers. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let sentinel: any = null;
    let cancelled = false;

    const request = async () => {
      try {
        // @ts-expect-error not in older lib.dom typings
        if (navigator.wakeLock) {
          // @ts-expect-error not in older lib.dom typings
          sentinel = await navigator.wakeLock.request("screen");
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