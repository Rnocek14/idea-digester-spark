import { Footprints, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShorePathStopRow } from "@/hooks/useShorePathStops";
import { StoryPlayer } from "./StoryPlayer";

type Props = {
  stop: ShorePathStopRow;
  distance: number; // meters
  onJumpToStop: (s: ShorePathStopRow) => void;
  onDismiss: () => void;
};

export function ArrivalCard({ stop, distance, onJumpToStop, onDismiss }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:pb-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-md rounded-xl border-2 border-amber-400 bg-white shadow-2xl overflow-hidden">
        <div className="bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4" />
            <p className="text-[11px] font-mono uppercase tracking-widest">
              You've arrived · {Math.round(distance)}m away
            </p>
          </div>
          <button onClick={onDismiss} aria-label="Dismiss" className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Stop {stop.order_index} · {stop.community || "Geneva Lake"}
            {stop.approx_mile != null && ` · Mile ${stop.approx_mile}`}
          </p>
          <h3 className="font-display text-xl text-slate-900 tracking-tight">
            {stop.name}
          </h3>
          {stop.audio_url ? (
            <div className="mt-3">
              <StoryPlayer
                audioUrl={stop.audio_url}
                transcript={stop.audio_transcript}
                durationSec={stop.audio_duration_sec}
                autoPlay
              />
            </div>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed mt-2">
              {stop.story_long || stop.description}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onJumpToStop(stop)}>
              Read the full write-up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}