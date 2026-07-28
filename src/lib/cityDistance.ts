// Pure helpers for the city finder: distance math, nearest-city matching, and
// zip → coordinates via the free Zippopotam API. No component state in here so
// the logic is unit-testable.

export type CityPoint = {
  id: string;
  city_name: string;
  state_code: string;
  site_domain: string;
  status: string;
  latitude: number;
  longitude: number;
};

/** Straight-line distance in km (haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type NearestResult = { city: CityPoint; distanceKm: number } | null;

/**
 * Nearest city to a point, or null when nothing is within maxKm.
 * ~56km (35mi) default: a reader inside that radius plausibly considers the
 * city "their" local news market; beyond it they're a waitlist signal.
 */
export function nearestCity(cities: CityPoint[], lat: number, lon: number, maxKm = 56): NearestResult {
  let best: NearestResult = null;
  for (const city of cities) {
    if (typeof city.latitude !== "number" || typeof city.longitude !== "number") continue;
    const d = haversineKm(lat, lon, city.latitude, city.longitude);
    if (d <= maxKm && (!best || d < best.distanceKm)) {
      best = { city, distanceKm: d };
    }
  }
  return best;
}

export type ZipLookup = { lat: number; lon: number; label: string } | null;

/** Shape returned by api.zippopotam.us/us/{zip}. Exported for tests. */
export function parseZippopotam(json: unknown): ZipLookup {
  const places = (json as { places?: Array<Record<string, string>> })?.places;
  const place = places?.[0];
  if (!place) return null;
  const lat = parseFloat(place.latitude);
  const lon = parseFloat(place.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  const label = [place["place name"], place["state abbreviation"]].filter(Boolean).join(", ");
  return { lat, lon, label };
}

export function isValidUsZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

export async function lookupZip(zip: string): Promise<ZipLookup> {
  if (!isValidUsZip(zip)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip.trim()}`);
    if (!res.ok) return null;
    return parseZippopotam(await res.json());
  } catch {
    return null;
  }
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}
