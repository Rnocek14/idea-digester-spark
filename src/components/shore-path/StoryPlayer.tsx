import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  audioUrl: string;
  transcript?: string | null;
  durationSec?: number | null;
  autoPlay?: boolean;
};

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StoryPlayer({ audioUrl, transcript, durationSec, autoPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(durationSec ?? 0);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (autoPlay) {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [audioUrl, autoPlay]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const restart = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().then(() => setPlaying(true)).catch(() => {});
  };

  return (
    <div className="rounded-md border border-slate-200 bg-stone-50 p-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => setT((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="default"
          onClick={toggle}
          aria-label={playing ? "Pause story" : "Play story"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={restart} aria-label="Restart story">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-[width]"
              style={{ width: dur > 0 ? `${(t / dur) * 100}%` : "0%" }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            {fmt(t)} / {fmt(dur)}
          </p>
        </div>
      </div>
      {transcript && (
        <div className="mt-2">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          {showTranscript && (
            <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}