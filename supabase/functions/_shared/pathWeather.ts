// Weather for a logged Shore Path visit.
//
// Open-Meteo, because it needs no API key and no account — which matters when the
// alternative is asking a walker to type the temperature, or making the whole
// conditions dataset depend on a credential someone has to maintain.
//
// The parsing and bucketing here are pure so they can be tested without network.

export type WeatherReading = {
  temp_f: number | null;
  feels_like_f: number | null;
  wind_mph: number | null;
  precip: string | null;
};

export const EMPTY_READING: WeatherReading = {
  temp_f: null,
  feels_like_f: null,
  wind_mph: null,
  precip: null,
};

/**
 * WMO weather codes, collapsed to the four words a walker would actually use.
 * The full table has 28 entries and the distinction between "slight" and
 * "moderate" drizzle is not information anyone planning a walk needs.
 */
export function precipFromWmoCode(code: number | null | undefined): string | null {
  if (typeof code !== "number" || !isFinite(code)) return null;
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  // Bounded at 99: the WMO table ends there, and an out-of-range code is bad
  // data rather than a thunderstorm.
  if (code >= 95 && code <= 99) return "storm";
  return null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && isFinite(n) ? n : null;
}

/** Parse an Open-Meteo `current=` response. Returns nulls rather than throwing. */
export function parseOpenMeteoCurrent(payload: unknown): WeatherReading {
  if (!payload || typeof payload !== "object") return EMPTY_READING;
  const current = (payload as Record<string, unknown>).current;
  if (!current || typeof current !== "object") return EMPTY_READING;
  const c = current as Record<string, unknown>;

  return {
    temp_f: num(c.temperature_2m),
    feels_like_f: num(c.apparent_temperature),
    wind_mph: num(c.wind_speed_10m),
    precip: precipFromWmoCode(num(c.weather_code)),
  };
}

/** Open-Meteo request URL. Units are requested in Fahrenheit and mph directly. */
export function openMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Truncate an instant to the top of its UTC hour — the weather cache key. */
export function hourKey(when: Date): string {
  const d = new Date(when.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * A reading with nothing in it is not worth caching or storing — it would make a
 * visit look like it had conditions data when it doesn't.
 */
export function hasAnyReading(r: WeatherReading): boolean {
  return r.temp_f != null || r.feels_like_f != null || r.wind_mph != null || r.precip != null;
}

export const CROWD_LEVELS = ["empty", "some", "busy"] as const;
export const GROUP_SIZE_BANDS = ["solo", "pair", "small", "large"] as const;

export type CrowdLevel = (typeof CROWD_LEVELS)[number];
export type GroupSizeBand = (typeof GROUP_SIZE_BANDS)[number];

export function isCrowdLevel(v: unknown): v is CrowdLevel {
  return typeof v === "string" && (CROWD_LEVELS as readonly string[]).includes(v);
}

export function isGroupSizeBand(v: unknown): v is GroupSizeBand {
  return typeof v === "string" && (GROUP_SIZE_BANDS as readonly string[]).includes(v);
}

/** Local hour, day-of-week (0 = Sunday) and month for a named timezone. */
export function localClockParts(
  when: Date,
  timeZone: string,
): { hour: number; dow: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(when);
  const find = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  // "24" appears at midnight in some ICU versions; normalise it to 0.
  const hour = Number(find("hour")) % 24;
  const month = Number(find("month"));
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = dowNames.indexOf(find("weekday"));

  return {
    hour: isFinite(hour) ? hour : 0,
    dow: dow >= 0 ? dow : 0,
    month: isFinite(month) && month >= 1 ? month : 1,
  };
}
