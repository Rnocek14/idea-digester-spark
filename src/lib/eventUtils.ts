import type { Json } from "@/integrations/supabase/types";

export type EventRow = {
  id: string;
  title: string;
  summary?: string | null;
  content_website?: string | null;
  content_lg_base?: string | null;
  category: string | null;
  event_date: string | null;
  event_time: string | null;
  performer?: string | null;
  original_url: string | null;
  image_url?: string | null;
  geo_tier?: number | null;
  geo_label?: string | null;
  metadata?: Json | null;
};

export const getMetaField = (
  metadata: Json | null | undefined,
  field: string,
): string | undefined => {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[field];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

export const extractVenue = (event: Pick<EventRow, "title" | "metadata">): string => {
  const metaVenue = getMetaField(event.metadata, "venue");
  if (metaVenue) return metaVenue;
  const metaLocation = getMetaField(event.metadata, "location");
  if (metaLocation) return metaLocation;

  const title = event.title || "";
  const atMatch = title.match(/\s(?:at|@)\s+(.+?)(?:\s*[-–—]|$)/i);
  if (atMatch) return atMatch[1].trim();
  const colonMatch = title.match(/^([^:–—]+?)(?::|–|—)\s/);
  if (colonMatch && colonMatch[1].length < 40) return colonMatch[1].trim();
  return "";
};

export const getShortTitle = (event: Pick<EventRow, "title">): string => {
  let title = event.title || "";
  title = title.replace(/\s+(?:at|@)\s+.+$/i, "");
  title = title.replace(/^[^:–—]+?(?::|–|—)\s+/, "");
  if (title.length > 80) title = title.substring(0, 77) + "...";
  return title;
};

export const formatEventTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return "";
  let hours = parseInt(match[1], 10);
  const minutes = match[2] || "00";
  let period = match[3]?.toUpperCase();
  if (!period) period = hours >= 12 ? "PM" : "AM";
  if (hours > 12) {
    hours -= 12;
    period = "PM";
  } else if (hours === 0) {
    hours = 12;
    period = "AM";
  }
  return `${hours}:${minutes} ${period}`;
};

export const categoryEmoji = (category: string | null): string => {
  const c = (category || "").toLowerCase();
  if (c.includes("music") || c.includes("entertainment")) return "🎵";
  if (c.includes("family")) return "👨‍👩‍👧‍👦";
  if (c.includes("nightlife")) return "🌙";
  if (c.includes("outdoor")) return "🌲";
  if (c.includes("dining") || c.includes("food")) return "🍽️";
  if (c.includes("shopping")) return "🛍️";
  if (c.includes("sports")) return "⚽";
  if (c.includes("civic")) return "🏛️";
  if (c.includes("arts") || c.includes("art")) return "🎨";
  return "🎉";
};

/** YYYY-MM-DD in local time (avoids UTC off-by-one). */
export const localDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const friendlyDayLabel = (dateStr: string): string => {
  // Parse as local date (treat YYYY-MM-DD as local, not UTC)
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

export const formatFullDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/** Parse an event_time string into a 24h "HH:MM" pair (default 19:00 if unknown). */
const parseTo24h = (timeStr: string | null | undefined): { hh: string; mm: string } => {
  if (!timeStr) return { hh: "19", mm: "00" };
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return { hh: "19", mm: "00" };
  let hours = parseInt(match[1], 10);
  const minutes = match[2] || "00";
  const period = match[3]?.toLowerCase();
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  if (!period && hours < 8) hours += 12; // assume PM for ambiguous "7:00"
  return { hh: String(hours).padStart(2, "0"), mm: minutes };
};

/** Build a downloadable .ics file for a single event. */
export const buildIcs = (event: EventRow): string => {
  if (!event.event_date) return "";
  const [y, m, d] = event.event_date.split("-");
  const start = parseTo24h(event.event_time);
  // Default 2-hour duration
  const endHour = (parseInt(start.hh, 10) + 2) % 24;
  const end = { hh: String(endHour).padStart(2, "0"), mm: start.mm };
  const dtStart = `${y}${m}${d}T${start.hh}${start.mm}00`;
  const dtEnd = `${y}${m}${d}T${end.hh}${end.mm}00`;
  const venue = extractVenue(event);
  const desc = (event.summary || event.content_website || "")
    .replace(/[\r\n]+/g, " ")
    .substring(0, 500);
  const url = event.original_url || "";
  const uid = `${event.id}@lakegenevabrief`;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lake Geneva Brief//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Chicago:${dtStart}`,
    `DTEND;TZID=America/Chicago:${dtEnd}`,
    `SUMMARY:${event.title.replace(/,/g, "\\,")}`,
    venue ? `LOCATION:${venue.replace(/,/g, "\\,")}` : "",
    desc ? `DESCRIPTION:${desc.replace(/,/g, "\\,")}` : "",
    url ? `URL:${url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
};

export const downloadIcs = (event: EventRow) => {
  const ics = buildIcs(event);
  if (!ics) return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().substring(0, 50)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const EVENT_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "events", label: "Events" },
  { value: "community", label: "Community" },
  { value: "entertainment", label: "Music & Arts" },
  { value: "dining", label: "Food & Drink" },
  { value: "nightlife", label: "Nightlife" },
  { value: "civic", label: "Civic" },
] as const;