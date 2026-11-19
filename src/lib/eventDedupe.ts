// Builds a comparable key for an event title so the same act listed twice
// (e.g. "Mike VanDyke @ PIER 290" and "Live Music: Mike VanDyke – November 19, 2026")
// collapses to one entry.
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

export function eventTitleKey(title: string): string {
  let t = title.toLowerCase();
  t = t.replace(/\s+(?:at|@)\s+.+$/i, "");                 // "... @ Venue"
  t = t.replace(/^(?:live music|music|live|concert|show)\s*[:\-–—]\s*/i, "");
  t = t.replace(new RegExp(`\\s*[-–—,|]?\\s*(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\\s*)?(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?\\s*$`, "i"), "");
  t = t.replace(/\s*[-–—]\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, "");
  return t.replace(/[^a-z0-9]+/g, "");
}
