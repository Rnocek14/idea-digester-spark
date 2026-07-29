// Shared editorial safety gate for ALL incident sources.
// Single source of truth for the tier keyword lists used by ingest-incident's
// tier engine, so cron scrapers (SpotCrime, sheriff releases, etc.) apply the
// same public-safety-critical filters instead of bypassing them.

// Tier 4: never auto-publish; auto-reject. Public-safety-critical strings.
//
// This list is a substring match, so it only catches the phrasings actually listed.
// The original set covered "arrest"/"charged with" and missed every synonym a police
// blotter actually uses — "taken into custody", "cited", "booked", "detained",
// "identified as" — which meant a line like "John Smith was taken into custody"
// passed the gate and published verbatim, with the name. In a town of 8,000 that is
// a real person's search results. Any phrasing that implies an individual has been
// accused, detained, or named belongs here.
export const TIER_4_REJECT = [
  "arrest", "arrested", "charged with", "domestic", "overdose", "od ",
  " od.", "suicide", "fatality", "fatal ", "deceased", "wanted suspect",
  "manhunt", "fugitive", "juvenile", "minor child", "underage",
  // Custody and detention, however phrased.
  "taken into custody", "in custody", "booked", "detained", "apprehended",
  "warrant", "jailed", "incarcerated", "bond hearing", "arraign",
  // Citation and prosecution.
  "cited for", "citation issued", "ticketed for", "referred to the district attorney",
  "referred for charges", "pending charges", "criminal complaint", "prosecut",
  "convicted", "sentenced", "pleaded",
  // Naming an individual. "identified as" almost always precedes a name or an age.
  "identified as", "name was released", "names were released", "next of kin",
  // Suspicion attached to a person rather than an event.
  "suspect was", "suspect is", "person of interest", "accused of", "alleged",
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

/**
 * Strip personal detail from third-party incident text before it is ever published.
 *
 * The keyword gate above is a denylist, and a denylist cannot be complete — a blotter
 * line can name someone without using any of those phrasings ("victim Jane Doe reported
 * a vehicle was entered overnight"). This is the second layer: even for text that passes
 * the gate, remove the things that identify an individual or a household.
 *
 * Deliberately aggressive. Over-redacting a scraped aggregator summary costs a reader
 * nothing — the incident type and the neighborhood are what's useful — while
 * under-redacting attaches a real name to a crime report permanently.
 */
export function redactPersonalDetails(text: string): string {
  if (!text) return "";
  let out = text;

  // Street addresses down to the block. "1428 Maple St" -> "the 1400 block of Maple St".
  out = out.replace(
    /\b(\d{1,5})\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Ct|Court|Way|Ter|Terrace|Pl|Place|Hwy|Highway)\b\.?)/g,
    (_m, num: string, street: string) => {
      const n = parseInt(num, 10);
      const block = n >= 100 ? Math.floor(n / 100) * 100 : 0;
      return block ? `the ${block} block of ${street}` : street;
    },
  );

  // Apartment / unit numbers.
  out = out.replace(/\b(?:apt|apartment|unit|suite|ste|room|rm)\.?\s*#?\s*[\w-]+/gi, "");

  // Ages, which combine with a neighborhood to identify someone.
  out = out.replace(/\b(?:a|an)?\s*\d{1,3}[-\s]year[-\s]old\b/gi, "a person");
  out = out.replace(/\b(\d{1,3})\s*(?:yo|y\/o)\b/gi, "a person");

  // Licence plates and phone numbers.
  out = out.replace(/\b[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}\b(?=\s*(?:plate|tag))/gi, "[plate]");
  out = out.replace(/\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, "");

  // Personal names: two or more consecutive capitalized words that aren't a known
  // place or role. Checked against an allowlist so "Williams Bay" and "Geneva Lake"
  // survive — a false positive on a place name is a worse read than a missed name is
  // a risk, so the allowlist stays short and specific.
  const PLACES = [
    "geneva lake", "lake geneva", "williams bay", "big foot", "genoa city",
    "walworth county", "fontana", "linn", "delavan", "elkhorn", "burlington",
    "wisconsin", "illinois", "chicago", "milwaukee", "shore path", "state park",
    "county jail", "district attorney", "sheriff department", "police department",
    "fire department", "rescue squad", "main street", "county road", "state highway",
  ];
  out = out.replace(/\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})\b/g, (m) => {
    return PLACES.includes(m.toLowerCase()) ? m : "";
  });

  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
}
