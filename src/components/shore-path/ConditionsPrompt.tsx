import { useState } from "react";
import { Users, X } from "lucide-react";
import type { CrowdLevel, GroupSizeBand } from "@/hooks/usePathRegister";

const CROWD_OPTIONS: { value: CrowdLevel; label: string; hint: string }[] = [
  { value: "empty", label: "Empty", hint: "Had it to myself" },
  { value: "some", label: "Some", hint: "A few others" },
  { value: "busy", label: "Busy", hint: "Steady traffic" },
];

const GROUP_OPTIONS: { value: GroupSizeBand; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "pair", label: "Two of us" },
  { value: "small", label: "A few" },
  { value: "large", label: "A group" },
];

type Props = {
  onAnswer: (answer: { crowd_level?: CrowdLevel; group_size_band?: GroupSizeBand }) => void;
  onDismiss: () => void;
};

/**
 * The only thing a walker is ever asked to supply, and it is one tap.
 *
 * Crowding is a three-way choice rather than a headcount because a headcount
 * would be invented — nobody remembers whether it was nine people or eleven —
 * and an invented number would poison the one dataset here nobody else has.
 * Group size is banded for the same reason, plus a second one: an exact ranked
 * count would reward recruiting one more person onto a single-file easement.
 */
export function ConditionsPrompt({ onAnswer, onDismiss }: Props) {
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:pb-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              {crowd ? "Who was with you?" : "How busy was it?"}
            </p>
          </div>
          <button onClick={onDismiss} aria-label="Skip" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {!crowd ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {CROWD_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setCrowd(o.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-3 text-center hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                One tap. It's what turns "the path is quieter on weekday mornings"
                from our opinion into something you can check.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {GROUP_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => onAnswer({ crowd_level: crowd, group_size_band: o.value })}
                    className="rounded-md border border-slate-300 bg-white px-1 py-3 text-center hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <span className="block text-xs font-medium text-slate-900">{o.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => onAnswer({ crowd_level: crowd })}
                className="text-[11px] text-slate-500 hover:text-slate-800 mt-3 underline"
              >
                Skip this bit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
