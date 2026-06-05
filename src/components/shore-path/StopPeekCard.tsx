import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowDown, Footprints } from "lucide-react";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";

type Props = {
  stop: ShorePathStopRow;
  onJump: () => void;
  onStartWalk: () => void;
};

/** Truncate a description to ~140 chars on a word boundary. */
function trim(text: string, max = 140) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return slice.slice(0, lastSpace > 60 ? lastSpace : max).trimEnd() + "…";
}

export function StopPeekCard({ stop, onJump, onStartWalk }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Stop {stop.order_index}
          {stop.community ? ` · ${stop.community}` : ""}
          {stop.approx_mile != null && ` · Mile ${stop.approx_mile}`}
        </p>
        <p className="font-display text-base text-slate-900 leading-tight mt-0.5">
          {stop.name}
        </p>
      </div>

      {stop.description && (
        <p className="text-sm text-slate-700 leading-snug">
          {trim(stop.description)}
        </p>
      )}

      <div className="flex flex-col gap-1.5 pt-1">
        <Button
          size="sm"
          className="w-full justify-center"
          onClick={onJump}
        >
          <ArrowDown className="h-3.5 w-3.5 mr-1.5" />
          Jump to this stop
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-center"
          onClick={onStartWalk}
        >
          <Footprints className="h-3.5 w-3.5 mr-1.5" />
          Start walk from here
        </Button>
      </div>
    </div>
  );
}