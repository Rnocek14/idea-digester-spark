// Loader for city_config — the single source of truth for city-specific facts.
// Edge functions call getCityConfig(supabase) instead of hardcoding bboxes,
// gazetteers, zones, and URLs. Falls back to the Lake Geneva defaults if the
// table/row is missing so no function ever breaks on a fresh environment.

// deno-lint-ignore-file no-explicit-any

export type CityBbox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type CityConfig = {
  id: string;
  city_name: string;
  state_code: string;
  county_name: string;
  timezone: string;
  latitude: number;
  longitude: number;
  bbox: CityBbox;
  local_keywords: string[];
  non_local_keywords: string[];
  nws_zones: string[];
  state_511_api_base: string | null;
  spotcrime_path: string | null;
  sheriff_press_url: string | null;
  utility_outage_url: string | null;
  site_domain: string;
  site_name: string;
  from_email: string;
  breaking_from_email: string | null;
  metadata: Record<string, unknown>;
};

export const LAKE_GENEVA_DEFAULTS: CityConfig = {
  id: "default",
  city_name: "Lake Geneva",
  state_code: "WI",
  county_name: "Walworth County",
  timezone: "America/Chicago",
  latitude: 42.5917,
  longitude: -88.4334,
  bbox: { minLat: 42.4953, maxLat: 42.8421, minLon: -88.7773, maxLon: -88.2891 },
  local_keywords: [
    "lake geneva", "geneva lake", "walworth", "williams bay", "fontana", "elkhorn",
    "delavan", "genoa city", "bloomfield", "town of linn", "lake como", "como",
    "powers lake", "darien", "east troy", "sharon", "burlington", "whitewater",
    "pell lake", "twin lakes", "lyons", "abbey resort", "grand geneva",
    "big foot beach", "wrigley drive", "hwy 50", "hwy 12", "highway 50", "highway 12",
    "us-12", "highway 67", "hwy 67", "highway 120", "hwy 120", "i-43", "interstate 43",
  ],
  non_local_keywords: [
    "milwaukee", "kenosha", "racine", "madison", "waukesha", "janesville", "beloit",
    "chicago", "rockford", "green bay", "brookfield", "wauwatosa", "minneapolis",
    "minnesota", "illinois", "indiana", "iowa", "michigan",
  ],
  nws_zones: ["WIZ063", "WIZ062", "WIZ057"],
  state_511_api_base: "https://511wi.gov/api",
  spotcrime_path: "WI/Walworth%20County",
  sheriff_press_url: "https://www.co.walworth.wi.us/747/News-Releases",
  utility_outage_url: null,
  site_domain: "lakegenevabrief.com",
  site_name: "Lake Geneva Brief",
  from_email: "newsletter@citybrief.info",
  breaking_from_email: "breaking@citybrief.info",
  metadata: {},
};

let cached: CityConfig | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCityConfig(supabase: any): Promise<CityConfig> {
  const now = Date.now();
  if (cached && now - cachedAtMs < CACHE_TTL_MS) return cached;

  try {
    const { data, error } = await supabase
      .from("city_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!error && data) {
      cached = {
        ...LAKE_GENEVA_DEFAULTS,
        ...data,
        bbox: (data.bbox as CityBbox) ?? LAKE_GENEVA_DEFAULTS.bbox,
        local_keywords: data.local_keywords?.length
          ? data.local_keywords
          : LAKE_GENEVA_DEFAULTS.local_keywords,
        non_local_keywords: data.non_local_keywords?.length
          ? data.non_local_keywords
          : LAKE_GENEVA_DEFAULTS.non_local_keywords,
      };
      cachedAtMs = now;
      return cached;
    }
    console.warn("[cityConfig] city_config row missing — using built-in defaults");
  } catch (e) {
    console.warn("[cityConfig] load failed — using built-in defaults:", e);
  }
  cached = LAKE_GENEVA_DEFAULTS;
  cachedAtMs = now;
  return cached;
}

export function withinBbox(bbox: CityBbox, lat?: number | null, lon?: number | null): boolean {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

export function hasLocalKeyword(config: CityConfig, text: string): boolean {
  const h = text.toLowerCase();
  return config.local_keywords.some((kw) => h.includes(kw));
}

export function hasNonLocalKeyword(config: CityConfig, text: string): boolean {
  const h = text.toLowerCase();
  return config.non_local_keywords.some((kw) => h.includes(kw));
}
