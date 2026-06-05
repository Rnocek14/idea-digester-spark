import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ShorePathMap } from "./ShorePathMap";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";

const STORAGE_KEY = "shorePathWalkingMode.currentIndex";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stops: ShorePathStopRow[];
  /** When provided, jumps Walking Mode to this index when opened. */
  initialIndex?: number | null;
};

export function ShorePathWalkingMode({ open, onOpenChange, stops, initialIndex }: Props) {
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });

  // When opened with an explicit starting stop, honor it.
  useEffect(() => {
    if (open && initialIndex != null && Number.isFinite(initialIndex)) {
      setIndex(initialIndex);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(index));
  }, [index]);

  const safeIndex = Math.min(Math.max(index, 0), Math.max(stops.length - 1, 0));
  const current = stops[safeIndex];
  const total = stops.length;
  const pct = total > 0 ? Math.round(((safeIndex + 1) / total) * 100) : 0;

  // Approximate distance walked / remaining along the 21-mile path.
  // Prefers each stop's stored approx_mile (from the DB); falls back to a
  // linear estimate if mile data isn't available yet.
  const TOTAL_MILES = 21;
  const milesWalked =
    current?.approx_mile != null
      ? Number(current.approx_mile)
      : total > 0
        ? Math.round(((safeIndex + 1) / total) * TOTAL_MILES * 10) / 10
        : 0;
  const milesRemaining = Math.max(0, Math.round((TOTAL_MILES - milesWalked) * 10) / 10);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Shore Path Walk
            </p>
            <p className="text-sm font-medium text-slate-900 truncate">
              Stop {safeIndex + 1} of {total} · {pct}% complete
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ≈ {milesWalked.toFixed(1)} mi in · {milesRemaining.toFixed(1)} mi to go
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="End walk"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-5 pt-3">
          <Progress value={pct} className="h-2" />
        </div>

        {/* Mini map */}
        <div className="px-5 pt-4">
          <ShorePathMap
            stops={stops}
            activeStopId={current.id}
            size="mini"
            onStopClick={(s) => {
              const i = stops.findIndex((x) => x.id === s.id);
              if (i >= 0) setIndex(i);
            }}
          />
        </div>

        {/* Current stop content */}
        <div className="px-5 py-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {current.community || "Geneva Lake"}
            {current.approx_mile != null && ` · Mile ${current.approx_mile}`}
          </p>
          <h2 className="font-display text-2xl text-slate-900 tracking-tight mt-1">
            {current.order_index}. {current.name}
          </h2>
          {current.description && (
            <p className="text-slate-700 leading-relaxed mt-3">
              {current.description}
            </p>
          )}
          {current.look_for && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700 mb-1">
                Look for
              </p>
              <p className="text-sm text-amber-900 leading-relaxed">{current.look_for}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            onClick={() =>
              setIndex((i) => Math.min(stops.length - 1, i + 1))
            }
            disabled={safeIndex >= stops.length - 1}
            className="flex-1"
          >
            Next stop
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}