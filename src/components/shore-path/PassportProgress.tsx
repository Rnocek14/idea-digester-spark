import { useState } from "react";
import { Award, Check, CloudOff, Footprints, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import type { RegisterProgress, RegisterEntry, SeasonBucket, WalkerProfile } from "@/hooks/usePathRegister";

const SEASON_LABELS: Record<SeasonBucket, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};
const SEASON_ORDER: SeasonBucket[] = ["spring", "summer", "fall", "winter"];

type Props = {
  hasPassport: boolean;
  walker: WalkerProfile | null;
  progress: RegisterProgress | null;
  entries: RegisterEntry[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  onUpdateProfile: (patch: Partial<WalkerProfile>) => Promise<boolean>;
};

/**
 * The walker's own passport panel. Deliberately reads as a stamp book rather
 * than a scoreboard — there is no ranking here and no time, because the Shore
 * Path is a public easement running past private front porches and racing it is
 * not something this desk is going to encourage.
 */
export function PassportProgress({
  hasPassport,
  walker,
  progress,
  entries,
  pendingCount,
  isLoading,
  error,
  onStart,
  onUpdateProfile,
}: Props) {
  const [name, setName] = useState("");
  const [town, setTown] = useState("");
  const [saving, setSaving] = useState(false);

  const loopEntry = entries.find((e) => e.tier === "loop");
  const fourSeasonsEntry = entries.find((e) => e.tier === "four_seasons");

  if (!hasPassport) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Footprints className="h-4 w-4 text-amber-600" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            The Shore Path Register
          </p>
        </div>
        <h3 className="font-display text-xl text-slate-900 tracking-tight mb-2">
          Collect the sixteen stops. Get a number that's yours for good.
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed mb-4">
          Walk the whole 21 miles — over a weekend, a summer, or five years, it
          makes no difference — and you're entered on the register with a
          permanent walker number, in the order you finished. There's no timing
          and no ranking. Stops are confirmed by where you actually stood.
        </p>
        <Button onClick={onStart} disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Start a passport
        </Button>
        <p className="text-[11px] text-slate-500 mt-2">
          No account and no email needed. Your passport lives in this browser,
          and you stay off the public register until you choose otherwise.
        </p>
        {error && <p className="text-xs text-rose-700 mt-2">{error}</p>}
      </div>
    );
  }

  const stopsVisited = progress?.stops_visited ?? 0;
  const stopsTotal = progress?.stops_total ?? 0;
  const pct = stopsTotal > 0 ? Math.round((stopsVisited / stopsTotal) * 100) : 0;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-amber-600" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Your passport
          </p>
        </div>
        {progress?.verification === "verified" && stopsVisited > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Every stop verified
          </span>
        )}
      </div>

      {/* Stops */}
      <p className="font-display text-2xl text-slate-900 tracking-tight">
        {stopsVisited} of {stopsTotal} stops
      </p>
      <Progress value={pct} className="h-2 mt-2 mb-1" />
      <p className="text-[11px] text-slate-500">
        {progress?.loop_complete
          ? "The loop is closed."
          : `${Math.max(0, stopsTotal - stopsVisited)} to go.`}
        {progress?.days_elapsed != null && stopsVisited > 1 && (
          <> Across {progress.days_elapsed} day{progress.days_elapsed === 1 ? "" : "s"}.</>
        )}
      </p>

      {pendingCount > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <CloudOff className="h-3.5 w-3.5" />
          {pendingCount} stop{pendingCount === 1 ? "" : "s"} saved on this device — they'll
          send when you have signal again.
        </p>
      )}

      {/* Numbered tiers */}
      <div className="mt-4 space-y-2">
        <TierRow
          label="The Loop"
          detail="All sixteen stops"
          earned={progress?.loop_complete === true}
          entry={loopEntry}
        />
        <TierRow
          label="Four Seasons"
          detail="The loop in all four seasons"
          earned={progress?.four_seasons_complete === true}
          entry={fourSeasonsEntry}
        />
      </div>

      {/* Shores — the rung between the first stop and all sixteen. Without this a
          walker at 6 of 16 has ten stops and nothing to aim at. Grouped from each
          stop's community, so it needs no leg map to be correct. */}
      {(progress?.shores?.length ?? 0) > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              By shore
            </p>
            <p className="text-[11px] text-slate-500">
              {progress!.shores_completed} of {progress!.shores.length} finished
            </p>
          </div>
          <ul className="space-y-1.5">
            {progress!.shores.map((s) => {
              const pctShore = s.stopsTotal > 0
                ? Math.round((s.stopsVisited / s.stopsTotal) * 100)
                : 0;
              return (
                <li key={s.community} className="flex items-center gap-3">
                  <span
                    className={`text-sm w-28 flex-shrink-0 truncate ${
                      s.complete ? "text-emerald-800 font-medium" : "text-slate-700"
                    }`}
                  >
                    {s.community}
                  </span>
                  <span className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${
                        s.complete ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                      style={{ width: `${pctShore}%` }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-500 w-10 text-right flex-shrink-0">
                    {s.complete ? (
                      <Check className="h-3.5 w-3.5 inline text-emerald-600" />
                    ) : (
                      `${s.stopsVisited}/${s.stopsTotal}`
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Season grid — the shoulder-season nudge, and the reason Four Seasons
          takes at least a year. */}
      {stopsTotal > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Seasons
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SEASON_ORDER.map((s) => {
              const count = progress?.season_stop_counts?.[s] ?? 0;
              const done = progress?.seasons_completed?.includes(s) === true;
              return (
                <div
                  key={s}
                  className={`rounded border px-2 py-1.5 text-center ${
                    done
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-stone-50"
                  }`}
                >
                  <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    {SEASON_LABELS[s]}
                  </p>
                  <p className={`text-sm font-medium ${done ? "text-emerald-800" : "text-slate-700"}`}>
                    {done ? <Check className="h-4 w-4 inline" /> : `${count}/${stopsTotal}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Register visibility */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        {walker?.display_name ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-900 font-medium truncate">
                {walker.display_name}
                {walker.home_town && (
                  <span className="text-slate-500 font-normal"> · {walker.home_town}</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {walker.is_public
                  ? "Listed on the public register."
                  : "Private — you won't appear on the register."}
              </p>
            </div>
            <Switch
              checked={walker.is_public}
              disabled={saving}
              aria-label="Appear on the public register"
              onCheckedChange={async (v) => {
                setSaving(true);
                await onUpdateProfile({ is_public: v });
                setSaving(false);
              }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-600">
              Add a name if you'd like to appear on the register when you finish.
              First name and last initial is plenty.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="walker-name" className="text-[11px]">Name</Label>
                <Input
                  id="walker-name"
                  value={name}
                  maxLength={40}
                  placeholder="Riley N."
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="walker-town" className="text-[11px]">Town (optional)</Label>
                <Input
                  id="walker-town"
                  value={town}
                  maxLength={60}
                  placeholder="Williams Bay"
                  onChange={(e) => setTown(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || name.trim().length === 0}
              onClick={async () => {
                setSaving(true);
                await onUpdateProfile({
                  display_name: name.trim(),
                  home_town: town.trim() || null,
                });
                setSaving(false);
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link to="/guides/lake-geneva-shore-path/register" className="text-blue-700 hover:underline font-medium">
          See the register
        </Link>
        <Link to="/guides/lake-geneva-shore-path/passport" className="text-blue-700 hover:underline font-medium">
          Print a paper passport
        </Link>
      </div>

      {error && <p className="text-xs text-rose-700 mt-2">{error}</p>}
    </div>
  );
}

function TierRow({
  label,
  detail,
  earned,
  entry,
}: {
  label: string;
  detail: string;
  earned: boolean;
  entry?: RegisterEntry;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded border px-3 py-2 ${
        earned ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-stone-50"
      }`}
    >
      {earned ? (
        <Award className="h-4 w-4 text-amber-700 flex-shrink-0" />
      ) : (
        <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${earned ? "text-amber-900" : "text-slate-700"}`}>
          {label}
        </p>
        <p className="text-[11px] text-slate-500">{detail}</p>
      </div>
      {entry && (
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-sm text-amber-900">#{entry.entry_number}</p>
          {entry.verification !== "verified" && (
            <p className="text-[10px] text-slate-500 capitalize">
              {entry.verification.replace("_", "-")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
