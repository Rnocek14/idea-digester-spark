// Shared editorial safety gate for ALL incident sources.
// Single source of truth for the tier keyword lists used by ingest-incident's
// tier engine, so cron scrapers (SpotCrime, sheriff releases, etc.) apply the
// same public-safety-critical filters instead of bypassing them.

// Tier 4: never auto-publish; auto-reject. Public-safety-critical strings.
export const TIER_4_REJECT = [
  "arrest", "arrested", "charged with", "domestic", "overdose", "od ",
  " od.", "suicide", "fatality", "fatal ", "deceased", "wanted suspect",
  "manhunt", "fugitive", "juvenile", "minor child", "underage",
];

// Tier 3: hold for human review. Includes missing-person and Silver/Amber alerts.
export const TIER_3_HOLD = [
  "police presence", "active scene", "large response", "multiple units",
  "missing person", "silver alert", "amber alert", "endangered",
  "shots fired", "weapons", "armed", "barricade", "evacuat",
  "fire with inj", "rollover", "extrication", "medical emergency",
  "developing", "unconfirmed",
];

export function matchAnyKeyword(haystack: string, needles: string[]): string | null {
  const h = haystack.toLowerCase();
  for (const n of needles) {
    if (h.includes(n)) return n;
  }
  return null;
}

/** Returns the matched Tier-4 keyword if this text must be rejected outright. */
export function tier4Match(text: string): string | null {
  return matchAnyKeyword(text, TIER_4_REJECT);
}

/** Returns the matched Tier-3 keyword if this text must be held for human review. */
export function tier3Match(text: string): string | null {
  return matchAnyKeyword(text, TIER_3_HOLD);
}
