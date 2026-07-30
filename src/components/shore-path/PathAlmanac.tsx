import { BarChart3, Thermometer } from "lucide-react";
import { usePathAlmanac } from "@/hooks/usePathAlmanac";
import {
  crowdShade,
  crowdWord,
  HOUR_BUCKETS,
  HOUR_LABELS,
  SEASON_BUCKETS,
  SEASON_LABELS,
  type HourBucket,
  type SeasonBucket,
} from "@/lib/pathAlmanacFormat";

/**
 * Conditions and crowding on the path, from logged walks.
 *
 * This exists to replace assertion with measurement. The guide's seasons section
 * says weekday mornings are quieter than weekend afternoons and that October is
 * the local pick; both are almost certainly right and neither is sourced. As
 * walks accumulate, this grid either backs them up or corrects them.
 *
 * Renders nothing until there is enough data to be worth printing — an almanac
 * built from two walks would be worse than no almanac, because it would look
 * authoritative.
 */
export function PathAlmanac() {
  const { data, isLoading } = usePathAlmanac();

  if (isLoading || !data) return null;

  const cells = new Map<string, { crowd_mean: number | null; samples: number; temp_median: number | null }>();
  for (const c of data.by_season_hour) {
    cells.set(`${c.season}:${c.hour_bucket}`, c);
  }

  // Nothing has cleared the sample floor yet. Say so plainly and invite walks
  // rather than rendering an empty grid that reads as broken.
  if (cells.size === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            The Almanac
          </p>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          Not enough logged walks yet to publish crowd figures. Every walk logged
          with the digital passport adds to this — at least {data.min_samples} walks
          in the same season and time of day before anything appears here, so a
          single outing never gets presented as the pattern.
          {data.total_visits > 0 && (
            <> {data.total_visits} stop{data.total_visits === 1 ? "" : "s"} logged so far.</>
          )}
        </p>
      </div>
    );
  }

  const weekdayVsWeekend = SEASON_BUCKETS.map((season) => {
    const weekday = data.by_season_daytype.find((d) => d.season === season && d.day_type === "weekday");
    const weekend = data.by_season_daytype.find((d) => d.season === season && d.day_type === "weekend");
    return { season, weekday, weekend };
  }).filter((r) => r.weekday && r.weekend);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            The Almanac
          </p>
        </div>
        <p className="text-[11px] text-slate-500">
          From {data.total_with_crowd} logged walk
          {data.total_with_crowd === 1 ? "" : "s"}
        </p>
      </div>

      <h3 className="font-display text-xl text-slate-900 tracking-tight mb-1">
        How busy the path actually is
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        Reported by walkers as they walked. A cell stays blank until at least{" "}
        {data.min_samples} walks fall in it.
      </p>

      {/* The grid. Wide content scrolls in its own container so the page body
          never scrolls sideways on a phone. */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[30rem] border-separate border-spacing-1">
          <caption className="sr-only">
            Reported crowding on the Lake Geneva Shore Path by season and time of day
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-left text-[10px] font-mono uppercase tracking-widest text-slate-500 pl-1 pb-1">
                Season
              </th>
              {HOUR_BUCKETS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-[10px] font-mono uppercase tracking-wide text-slate-500 pb-1"
                >
                  {HOUR_LABELS[h]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEASON_BUCKETS.map((season) => (
              <tr key={season}>
                <th
                  scope="row"
                  className="text-left text-sm text-slate-800 font-medium pr-2 whitespace-nowrap"
                >
                  {SEASON_LABELS[season]}
                </th>
                {HOUR_BUCKETS.map((hour) => (
                  <AlmanacCell key={hour} cell={cells.get(`${season}:${hour}`)} season={season} hour={hour} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Quieter
        </span>
        <span className="flex gap-1">
          {["bg-emerald-100", "bg-lime-100", "bg-amber-100", "bg-orange-200"].map((c) => (
            <span key={c} className={`inline-block h-3 w-6 rounded-sm ${c}`} />
          ))}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Busier
        </span>
      </div>

      {/* Weekday vs weekend — the specific claim the guide makes unsourced. */}
      {weekdayVsWeekend.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Weekday vs weekend
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {weekdayVsWeekend.map((r) => (
              <li key={r.season} className="flex items-baseline gap-2 flex-wrap">
                <span className="text-slate-900 font-medium">{SEASON_LABELS[r.season]}:</span>
                <span>
                  {crowdWord(r.weekday!.crowd_mean).toLowerCase()} on weekdays,{" "}
                  {crowdWord(r.weekend!.crowd_mean).toLowerCase()} at weekends
                </span>
                <span className="text-[11px] text-slate-400">
                  ({r.weekday!.samples + r.weekend!.samples} walks)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Callouts: when to go, and where the sun is worst. */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        {data.quietest && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-700">
              Quietest logged
            </p>
            <p className="text-sm text-emerald-950 mt-0.5 leading-snug">
              {SEASON_LABELS[data.quietest.season]},{" "}
              {HOUR_LABELS[data.quietest.hour_bucket].toLowerCase()}, on a{" "}
              {data.quietest.day_type === "weekend" ? "weekend" : "weekday"}.
            </p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              {data.quietest.samples} walks
            </p>
          </div>
        )}
        {data.warmest?.temp_median != null && (
          <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-orange-700 flex items-center gap-1">
              <Thermometer className="h-3 w-3" /> Warmest logged
            </p>
            <p className="text-sm text-orange-950 mt-0.5 leading-snug">
              {SEASON_LABELS[data.warmest.season]},{" "}
              {HOUR_LABELS[data.warmest.hour_bucket].toLowerCase()} — median{" "}
              {Math.round(data.warmest.temp_median)}°F.
            </p>
            <p className="text-[11px] text-orange-800 mt-0.5">
              The open shoreline has very little shade.
            </p>
          </div>
        )}
      </div>

      {data.by_community.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-200">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            By stretch
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
            {data.by_community.map((c) => (
              <li key={c.community} className="flex justify-between gap-2">
                <span className="text-slate-900">{c.community}</span>
                <span className="text-slate-600">
                  {crowdWord(c.crowd_mean).toLowerCase()}
                  <span className="text-slate-400 text-[11px]"> · {c.samples}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        Crowding is self-reported by walkers on a three-point scale; temperature is
        recorded automatically for the hour of each walk. Individual walks are never
        published — only buckets that clear the {data.min_samples}-walk floor.
      </p>
    </div>
  );
}

function AlmanacCell({
  cell,
  season,
  hour,
}: {
  cell?: { crowd_mean: number | null; samples: number };
  season: SeasonBucket;
  hour: HourBucket;
}) {
  const label = `${SEASON_LABELS[season]}, ${HOUR_LABELS[hour]}`;
  if (!cell) {
    return (
      <td
        className="rounded border border-slate-200 bg-stone-50 text-center py-2 text-slate-300 text-sm"
        aria-label={`${label}: not enough walks logged`}
      >
        —
      </td>
    );
  }
  return (
    <td
      className={`rounded border text-center py-1.5 ${crowdShade(cell.crowd_mean)}`}
      aria-label={`${label}: ${crowdWord(cell.crowd_mean)}, ${cell.samples} walks`}
    >
      <span className="block text-xs font-medium leading-tight">
        {crowdWord(cell.crowd_mean)}
      </span>
      <span className="block text-[10px] opacity-70">{cell.samples}</span>
    </td>
  );
}
