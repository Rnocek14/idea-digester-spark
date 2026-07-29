import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { findArrival, vibrate } from "@/lib/shorePathGeo";
import { ArrivalCard } from "./ArrivalCard";

const TRIGGERED_KEY = "shore-path-guided-walk-triggered";

export type ArrivalRecord = {
  stop_slug: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stops: ShorePathStopRow[];
  onJumpToStop: (s: ShorePathStopRow) => void;
  /**
   * Called once per stop per session when the geofence fires, with the fix that
   * triggered it. The server re-checks these coordinates before it will record a
   * stop as verified, so this is a report rather than an assertion.
   */
  onArrival?: (arrival: ArrivalRecord) => void;
};

type Phase = "preamble" | "active";

function loadTriggered(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TRIGGERED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}
function saveTriggered(s: Set<string>) {
  try {
    sessionStorage.setItem(TRIGGERED_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

export function GuidedWalkController({ open, onClose, stops, onJumpToStop, onArrival }: Props) {
  const [phase, setPhase] = useState<Phase>("preamble");
  const [arrival, setArrival] = useState<{ stop: ShorePathStopRow; distance: number } | null>(null);
  const triggeredRef = useRef<Set<string>>(loadTriggered());

  const active = open && phase === "active";
  const geo = useGeolocation(active);
  useWakeLock(active);

  // Held in a ref so a parent re-render can't restart the geofence watcher.
  const onArrivalRef = useRef(onArrival);
  useEffect(() => {
    onArrivalRef.current = onArrival;
  }, [onArrival]);

  // Reset to preamble each time the sheet is closed.
  useEffect(() => {
    if (!open) {
      setPhase("preamble");
      setArrival(null);
    }
  }, [open]);

  // Watch geolocation and trigger arrivals once per session per stop.
  useEffect(() => {
    if (!active || geo.status !== "granted") return;
    const hit = findArrival(geo.lat, geo.lng, stops);
    if (!hit) return;
    if (triggeredRef.current.has(hit.stop.id)) return;
    triggeredRef.current.add(hit.stop.id);
    saveTriggered(triggeredRef.current);
    vibrate([180, 90, 180]);
    setArrival(hit);
    // Report the fix that fired the geofence so the stop can be stamped. Never
    // awaited: a slow or failed write must not hold up the arrival card.
    onArrivalRef.current?.({
      stop_slug: hit.stop.slug,
      latitude: geo.lat,
      longitude: geo.lng,
      accuracy_m: Number.isFinite(geo.accuracy) ? geo.accuracy : null,
    });
  }, [active, geo, stops]);

  // Nearest upcoming stop for the status bar.
  const nearest = useMemo(() => {
    if (!active || geo.status !== "granted") return null;
    let best: { stop: ShorePathStopRow; distance: number } | null = null;
    for (const s of stops) {
      if (s.latitude == null || s.longitude == null) continue;
      const dLat = s.latitude - geo.lat;
      const dLng = s.longitude - geo.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000; // rough meters
      if (!best || dist < best.distance) best = { stop: s, distance: dist };
    }
    return best;
  }, [active, geo, stops]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm">
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div className="mx-auto max-w-md w-full bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-slate-900">Guided Walk</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          </div>

          {phase === "preamble" && (
            <div className="p-5">
              <h3 className="font-display text-xl text-slate-900 tracking-tight mb-2">
                The Brief walks with you.
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">
                Put your phone in your pocket. When you reach one of the 16
                Shore Path stops, we'll gently let you know there's a story
                here.
              </p>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Guided Walk works while this page is open and your
                    phone is awake. Location stays on your device and is
                    only used to alert you near Shore Path stops.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setPhase("active")}
              >
                Allow location & start
              </Button>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                You can stop at any time.
              </p>
            </div>
          )}

          {phase === "active" && (
            <div className="p-5">
              {geo.status === "requesting" && (
                <p className="text-sm text-slate-600">Asking for your location…</p>
              )}
              {geo.status === "denied" && (
                <div className="text-sm text-slate-700">
                  <p className="font-medium text-slate-900 mb-1">Location was declined.</p>
                  <p>
                    Re-enable location for this site in your browser settings,
                    or close this and use the manual walking mode instead.
                  </p>
                </div>
              )}
              {geo.status === "unavailable" && (
                <p className="text-sm text-slate-700">{geo.error}</p>
              )}
              {geo.status === "error" && (
                <p className="text-sm text-slate-700">{geo.error}</p>
              )}
              {geo.status === "granted" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Listening for your next stop…
                  </div>
                  {nearest && (
                    <div className="rounded-md bg-stone-50 border border-slate-200 p-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        Nearest stop
                      </p>
                      <p className="font-display text-base text-slate-900">
                        {nearest.stop.name}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        About {Math.round(nearest.distance)} m away
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Accuracy: ±{Math.round(geo.accuracy)} m · Keep this page open.
                  </p>
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={onClose}
              >
                End Guided Walk
              </Button>
            </div>
          )}
        </div>
      </div>

      {arrival && (
        <ArrivalCard
          stop={arrival.stop}
          distance={arrival.distance}
          onJumpToStop={(s) => {
            setArrival(null);
            onClose();
            onJumpToStop(s);
          }}
          onDismiss={() => setArrival(null)}
        />
      )}
    </div>
  );
}