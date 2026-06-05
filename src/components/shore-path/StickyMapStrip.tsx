import { ArrowUp } from "lucide-react";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";

type Props = {
  stop: ShorePathStopRow;
  totalStops: number;
  visible: boolean;
  onBackToMap: () => void;
};

/** Slim sticky strip shown after the user jumps to a stop from the map.
 *  Desktop-only — on phones the page is already narrow enough that it
 *  would eat too much vertical real estate. */
export function StickyMapStrip({ stop, totalStops, visible, onBackToMap }: Props) {
  return (
    <div
      aria-hidden={!visible}
      className={[
        "hidden lg:block fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm",
        "transition-transform duration-200",
        visible ? "translate-y-0" : "-translate-y-full",
      ].join(" ")}
    >
      <div className="mx-auto max-w-5xl px-6 py-2 flex items-center gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
          {stop.order_index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 leading-none">
            Currently viewing · Stop {stop.order_index} of {totalStops}
          </p>
          <p className="text-sm font-medium text-slate-900 truncate leading-tight mt-0.5">
            {stop.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToMap}
          className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Back to map
        </button>
      </div>
    </div>
  );
}