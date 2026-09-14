// One place that decides WHICH AI provider the ingestion pipeline talks to.
//
// Why this exists: every scraper used to call api.openai.com directly with
// OPENAI_API_KEY. When that account ran out of credits, OpenAI returned 429
// insufficient_quota on every call — so the AI step failed, sources produced
// zero items, and the site quietly went stale while every fetch still counted
// as "successful". A dead billing account should never be able to starve
// coverage, so:
//
//   1. The Lovable AI gateway is tried FIRST whenever LOVABLE_API_KEY is set.
//   2. OpenAI is the fallback, not the primary.
//   3. If one provider returns a billing/quota/auth failure, the other is
//      tried before the item is given up on.
//
// Call sites keep their own retry/backoff loops; this only decides routing.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Gateway equivalent for the small/fast OpenAI models the scrapers use.
const GATEWAY_MODEL = "google/gemini-2.5-flash";

type Provider = { name: "gateway" | "openai"; url: string; key: string; model: string };

/** Statuses where retrying the SAME provider is pointless but the other may work. */
function shouldFailOver(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429;
}

function providers(requestedModel: string): Provider[] {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const list: Provider[] = [];

  // A model id that already carries a vendor prefix is gateway-native.
  const gatewayModel = requestedModel.includes("/") ? requestedModel : GATEWAY_MODEL;

  if (lovableKey) list.push({ name: "gateway", url: GATEWAY_URL, key: lovableKey, model: gatewayModel });
  if (openaiKey && !requestedModel.includes("/")) {
    list.push({ name: "openai", url: OPENAI_URL, key: openaiKey, model: requestedModel });
  }
  return list;
}

export function aiConfigured(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
}

/**
 * Chat-completions call with provider failover. Takes and returns the same
 * shapes `fetch` would, so it drops into existing call sites unchanged.
 */
export async function aiChat(payload: Record<string, unknown>): Promise<Response> {
  const requested = typeof payload.model === "string" ? payload.model : "gpt-4o-mini";
  const list = providers(requested);

  if (list.length === 0) {
    throw new Error("No AI API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)");
  }

  let last: Response | null = null;
  for (const p of list) {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model: p.model }),
    });

    if (res.ok) return res;

    last = res;
    if (!shouldFailOver(res.status)) return res;

    const detail = await res.clone().text().catch(() => "");
    console.warn(`[ai] ${p.name} failed ${res.status}: ${detail.slice(0, 180)} — trying next provider`);
  }
  return last!;
}

/**
 * Drop-in replacement for a direct `fetch("https://api.openai.com/...", init)`
 * call. The URL argument is ignored — routing is decided by aiChat — so an
 * existing call site only needs its function name changed. Keeping the fetch
 * shape means the surrounding retry loops and response handling stay as-is.
 */
export async function aiFetch(_url: string, init: { body: string; [k: string]: unknown }): Promise<Response> {
  return aiChat(JSON.parse(init.body) as Record<string, unknown>);
}
