const SESSION_KEY = "lg_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}