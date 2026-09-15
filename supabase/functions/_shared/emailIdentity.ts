// Every outbound email's identity and per-subscriber links, derived from
// `city_config` instead of hardcoded strings.
//
// Why this exists: the newsletter builders used to hardcode a sender address,
// a brand name, and `https://lakegeneva.news` links while the site canonical
// (and every prerendered page) is `city_config.site_domain`. Three names for
// one publication costs trust in a small town, splits SEO across domains, and
// silently breaks the moment a second city ships — city #2's newsletter would
// have linked readers to Lake Geneva. One derivation, one source of truth.

import { LAKE_GENEVA_DEFAULTS, type CityConfig } from "./cityConfig.ts";

/**
 * Fallback origin for the handful of transactional functions that read a base
 * URL at module scope, before any supabase client exists to load city_config.
 * They accept an APP_BASE_URL override; this is only what they use when it is
 * unset — and it must match the canonical site, not a second domain.
 */
export const DEFAULT_SITE_ORIGIN = `https://${LAKE_GENEVA_DEFAULTS.site_domain}`;

/** Absolute origin for reader-facing links, e.g. "https://lakegenevabrief.com". */
export function siteOrigin(config: Pick<CityConfig, "site_domain">): string {
  const domain = String(config.site_domain || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return domain ? `https://${domain}` : "";
}

/** RFC 5322 From header, e.g. `Lake Geneva Brief <newsletter@citybrief.info>`. */
export function fromAddress(
  config: Pick<CityConfig, "site_name" | "from_email">,
): string {
  return `${config.site_name} <${config.from_email}>`;
}

/** The token-based one-click unsubscribe endpoint for one subscriber. */
export function unsubscribeUrl(functionsBaseUrl: string, token: string): string {
  return `${functionsBaseUrl}/functions/v1/unsubscribe?token=${token}`;
}

/**
 * A subscriber's personal referral link.
 *
 * The credit trigger (`increment_referral_count`) only fires on a new row's
 * `referred_by_code`, so a link is worth sending ONLY when we have that
 * subscriber's real code — a placeholder or generated code credits nobody and
 * quietly teaches readers that sharing does nothing. Returns null when there
 * is no code, and callers drop the block entirely.
 */
export function referralUrl(
  origin: string,
  referralCode: string | null | undefined,
): string | null {
  const code = (referralCode || "").trim();
  if (!code || !origin) return null;
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Bulk-sender headers Gmail and Yahoo have required since February 2024.
 *
 * `List-Unsubscribe-Post` is what makes the mail client's own "Unsubscribe"
 * button work without the reader ever opening the message — the difference
 * between an unsubscribe (free) and a spam report (which costs the sending
 * domain's reputation for every other subscriber).
 */
export function bulkMailHeaders(unsubUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
