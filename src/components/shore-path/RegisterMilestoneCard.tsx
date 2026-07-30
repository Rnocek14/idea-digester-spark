import { Award, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { RegisterEntry } from "@/hooks/usePathRegister";

const TIER_COPY: Record<RegisterEntry["tier"], { eyebrow: string; title: string; body: string }> = {
  loop: {
    eyebrow: "The loop is closed",
    title: "Shore Path Walker",
    body:
      "All sixteen stops, all 21 miles. Your number is issued in the order you finished and it stays yours — nobody else will ever hold it.",
  },
  four_seasons: {
    eyebrow: "Four seasons",
    title: "Four Seasons Walker",
    body:
      "The whole loop in spring, summer, fall and winter. Very few people have walked the path in February, and now you're on the short list who have.",
  },
};

type Props = {
  entry: RegisterEntry;
  onDismiss: () => void;
};

/**
 * The payoff moment. Closing the loop is the entire point of the register, so it
 * gets a real card rather than a toast that slides away before it's read.
 */
export function RegisterMilestoneCard({ entry, onDismiss }: Props) {
  const copy = TIER_COPY[entry.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm px-3 pb-3 sm:pb-0">
      <div className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <p className="text-[11px] font-mono uppercase tracking-widest">{copy.eyebrow}</p>
          </div>
          <button onClick={onDismiss} aria-label="Dismiss" className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {copy.title}
          </p>
          <p className="font-display text-5xl text-slate-900 tracking-tight mt-1">
            #{entry.entry_number}
          </p>
          {entry.display_name && (
            <p className="text-sm text-slate-700 mt-1">
              {entry.display_name}
              {entry.home_town && <span className="text-slate-500"> · {entry.home_town}</span>}
            </p>
          )}

          <p className="text-sm text-slate-700 leading-relaxed mt-4 text-left">{copy.body}</p>

          {entry.days_elapsed != null && (
            <p className="text-[11px] text-slate-500 mt-2 text-left">
              Completed over {entry.days_elapsed} day{entry.days_elapsed === 1 ? "" : "s"}.
            </p>
          )}

          {entry.certificate_code && (
            <div className="mt-4 rounded-md bg-stone-50 border border-slate-200 px-4 py-3 text-left">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Certificate code
              </p>
              <p className="font-mono text-sm text-slate-900 mt-0.5">{entry.certificate_code}</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Keep this. It's how the desk confirms your entry when finisher
                certificates are issued.
              </p>
            </div>
          )}

          {entry.verification !== "verified" && (
            <p className="text-[11px] text-slate-600 mt-3 text-left leading-relaxed">
              One or more of your stops couldn't be confirmed by location, so this
              entry is marked <strong>{entry.verification.replace("_", "-")}</strong> on
              the register. Walking those stops again with location on will upgrade it.
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/guides/lake-geneva-shore-path/register">See the register</Link>
            </Button>
            <Button size="sm" className="flex-1" onClick={onDismiss}>
              Keep walking
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
