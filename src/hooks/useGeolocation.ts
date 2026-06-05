import { useEffect, useRef, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; lat: number; lng: number; accuracy: number; heading: number | null; updatedAt: number }
  | { status: "denied"; error: string }
  | { status: "unavailable"; error: string }
  | { status: "error"; error: string };

/** watchPosition wrapper. Only starts when `active` is true. */
export function useGeolocation(active: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchId.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setState({ status: "idle" });
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unavailable", error: "Geolocation is not supported on this device." });
      return;
    }

    setState({ status: "requesting" });
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: "granted",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          updatedAt: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: "denied", error: "Location permission was declined." });
        } else {
          setState({ status: "error", error: err.message || "Could not read your location." });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [active]);

  return state;
}