// Haversine distance in meters between two lat/lng pairs.
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type WithCoords = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
};

/** Return the closest stop within its geofence, or null. */
export function findArrival<T extends WithCoords>(
  userLat: number,
  userLng: number,
  stops: T[],
  defaultRadius = 140,
): { stop: T; distance: number } | null {
  let best: { stop: T; distance: number } | null = null;
  for (const s of stops) {
    if (s.latitude == null || s.longitude == null) continue;
    const d = distanceMeters(userLat, userLng, s.latitude, s.longitude);
    const r = s.geofence_radius_m ?? defaultRadius;
    if (d <= r && (!best || d < best.distance)) {
      best = { stop: s, distance: d };
    }
  }
  return best;
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as Navigator).vibrate(pattern);
    } catch {
      // ignore
    }
  }
}