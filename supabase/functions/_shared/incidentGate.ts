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

// ---------------------------------------------------------------------------
// RENDER-TIME redaction — the second of TWO redactors in this file.
//
// WHY THERE ARE TWO. They run at different moments on different text and must
// not be merged:
//
//   redactPersonalDetails()  (above)  — INGESTION time, on write. Input is raw
//     third-party blotter/aggregator prose. It nukes ANY capitalised bigram not
//     on a short place allowlist, because a scraped sentence can name someone
//     in a shape no targeted rule anticipates. Over-redacting a scraped summary
//     costs a reader nothing.
//
//   redactForPublicRender()  (below)  — RENDER time, on read. Input is stored,
//     already-processed fields (incident titles, locations, update text) that
//     the ingesters largely generate from structured data. The ingestion rule
//     would be destructive here: "Water Main Break" is a capitalised bigram and
//     would vanish, blanking legitimate headlines on every public page. So this
//     one is targeted — rank+name, "identified as X Y", "X Y, of", "First M.
//     Last" — plus exact addresses, ages, plates, phones and emails.
//
// Both are defence in depth BEHIND the tier gate, never a substitute for it.
// This is a town of ~8,000 people. Over-redaction is a cosmetic problem;
// under-redaction is a person's life.
//
// This merges two implementations that had drifted apart across tracks (one in
// _shared/renderPage.ts, one in serve-data/redact.ts) and disagreed on output.
// ---------------------------------------------------------------------------

const STREET_SUFFIX = [
  "st", "street", "ave", "avenue", "rd", "road", "dr", "drive", "ln", "lane",
  "blvd", "boulevard", "ct", "court", "cir", "circle", "way", "pl", "place",
  "ter", "terrace", "pkwy", "parkway", "trl", "trail",
].join("|");

/** Words that legitimately follow a rank and are not a person's name. */
const NOT_A_NAME = [
  "Office", "Offices", "Department", "Dept", "County", "Deputies", "Deputy",
  "Patrol", "Squad", "Report", "Reports", "News", "Release", "Releases",
  "Division", "Bureau", "Station", "Substation", "Detective", "Sergeant",
].join("|");

const RANK = [
  "Mr", "Mrs", "Ms", "Miss", "Dr", "Sgt", "Sergeant", "Deputy", "Officer",
  "Chief", "Det", "Detective", "Lt", "Lieutenant", "Capt", "Captain",
  "Trooper", "Sheriff", "Patrolman", "Cpl", "Corporal",
].join("|");

/**
 * 1247 -> "1200", 42 -> "unit". Arithmetic on the source value, not invention.
 * "the unit block of Main Street" is the standard police-blotter form for a
 * two-digit house number, and hides more than rounding 42 down to 40 would.
 */
function blockOf(raw: string): string {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return "unit";
  const b = Math.floor(n / 100) * 100;
  return b === 0 ? "unit" : String(b);
}

/**
 * Whitespace and orphaned-punctuation tidying. Removes no information; it is
 * factored out so containsPersonalDetail() can tell "redaction deleted
 * something" apart from "redaction tidied spacing". Only spaces and tabs are
 * collapsed — newlines survive, because serve-page splits paragraphs on them
 * AFTER redaction runs.
 */
function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;])/g, "$1")
    .replace(/[,;\s]+$/g, "")
    .trim();
}

/**
 * Strip personally identifying detail from any text bound for a public
 * surface. Idempotent: running it twice produces the same string.
 */
export function redactForPublicRender(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  if (!s) return "";

  // --- Contact details -----------------------------------------------------
  s = s.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g, "[email withheld]");
  s = s.replace(
    /(?<![\d-])(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?![\d-])/g,
    "[phone withheld]",
  );

  // --- Vehicle plates ------------------------------------------------------
  s = s.replace(
    /\b(?:lic(?:ense)?\.?\s*)?plates?\s*(?:#|no\.?|number)?\s*[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{2,5}\b/gi,
    "[plate withheld]",
  );

  // --- Ages ----------------------------------------------------------------
  s = s.replace(/\b\d{1,3}[-\s]?year[-\s]?old\b/gi, "[age withheld]");
  s = s.replace(/\bages?d?\s+\d{1,3}\b/gi, "[age withheld]");
  // The police-blotter form: "Jane Doe, 42, of ..."
  s = s.replace(/,\s*\d{1,3}\s*,(?=\s)/g, ", [age withheld],");

  // --- Names ---------------------------------------------------------------
  // Rank/honorific followed by a capitalised word that is not an org noun.
  s = s.replace(
    new RegExp(
      `\\b(${RANK})\\.?\\s+(?!(?:${NOT_A_NAME})\\b)[A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+)?`,
      "g",
    ),
    "$1 [name withheld]",
  );
  // Verbs that only ever introduce a person.
  s = s.replace(
    /\b(identified as|named|arrested|charged)\s+[A-Z][a-z]+\s+[A-Z][A-Za-z'’-]+/g,
    "$1 [name withheld]",
  );
  // "Jane Doe, of ..." — the age between them is already gone by now.
  s = s.replace(
    /\b[A-Z][a-z]+\s+[A-Z][A-Za-z'’-]+(?=,\s*(?:\[age withheld\],\s*)?of\b)/g,
    "[name withheld]",
  );
  // First M. Last — a shape that is essentially only ever a person.
  s = s.replace(
    /\b[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][A-Za-z'’-]+\b/g,
    "[name withheld]",
  );

  // --- Exact addresses -----------------------------------------------------
  // Apartment / unit designators are exact-location detail in a town this size.
  // Runs BEFORE the block rule so it cannot eat the "unit block of" that rule
  // emits. The designator must be numeric or a single letter, so "parking lot
  // fire" and "room and contents" survive.
  s = s.replace(
    /\b(?:apt|apartment|unit|suite|ste|room|rm)\.?\s*#?\s*(?:\d[\w-]{0,5}|[A-Z])\b/gi,
    "",
  );
  // "123 W Main St" -> "the 100 block of W Main St". Requires a real street
  // suffix, so "Highway 50" / "Hwy 12" (number AFTER the word) are untouched.
  s = s.replace(
    new RegExp(
      `\\b(\\d{1,5})[A-Za-z]?\\s+((?:[NSEW]\\.?\\s+)?[A-Za-z][\\w'’.-]*(?:\\s+[A-Za-z][\\w'’.-]*)?\\s+(?:${STREET_SUFFIX})\\b)`,
      "gi",
    ),
    (_m, num: string, rest: string) => `the ${blockOf(num)} block of ${rest}`,
  );
  // Wisconsin-style rural fire numbers: "W1234 County Rd NN", "N88 Oak".
  s = s.replace(/\b[NSEW]\d{3,6}\b/g, "[address withheld]");

  return tidy(s);
}

/**
 * True if redaction would actually REMOVE something from this text, as opposed
 * to merely tidying its whitespace.
 *
 * Needed because redaction is not always sufficient on its own. Some published
 * fields are DERIVED from the raw text upstream and cannot be redacted after
 * the fact — most importantly `incidents.slug`, which the ingesters compute as
 * slugify(raw title) and which is baked into a record's canonical URL. There is
 * no way to scrub a slug without breaking the URL it names, so the only safe
 * move is to refuse to publish the record at all. This predicate detects that.
 */
export function containsPersonalDetail(input: unknown): boolean {
  if (input === null || input === undefined) return false;
  const raw = String(input);
  return redactForPublicRender(raw) !== tidy(raw);
}

/**
 * True when every supplied fragment clears BOTH tiers of the editorial gate.
 * A row that fails this must not be rendered: 404 for a detail route, omitted
 * from an index. Callers pass every text field that would become visible.
 */
export function passesIncidentGate(...parts: Array<unknown>): boolean {
  const haystack = parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map((p) => String(p))
    .join(" \n ");
  if (!haystack.trim()) return true;
  return !tier4Match(haystack) && !tier3Match(haystack);
}

/** Gate + redact in one call. Returns null when the text must not be shown. */
export function publicIncidentText(...parts: Array<unknown>): string | null {
  if (!passesIncidentGate(...parts)) return null;
  return redactForPublicRender(parts.filter(Boolean).map(String).join("\n\n"));
}
