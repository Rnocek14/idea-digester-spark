import { useState } from "react";
import { Clock, Flame, Snowflake, Sunrise, Sunset, Thermometer, Users, Footprints, Hourglass } from "lucide-react";
import { usePathNotables, type NotableWalk } from "@/hooks/usePathNotables";
import { formatMinutes } from "@/lib/pathAlmanacFormat";

const SEASONS = [
  { value: null, label: "All year" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const;

const SHORES = [
  { value: null, label: "Whole lake" },
  { value: "Lake Geneva", label: "Lake Geneva" },
  { value: "Linn", label: "Linn" },
  { value: "Fontana", label: "Fontana" },
  { value: "Williams Bay", label: "Williams Bay" },
] as const;

const GROUP_WORDS: Record<string, string> = {
  solo: "walking alone",
  pair: "two of them",
  small: "a few of them",
  large: "a group",
};

function walkerLabel(w: NotableWalk): string {
  if (!w.display_name) return "A walker";
  return w.home_town ? `${w.display_name} · ${w.home_town}` : w.display_name;
}

function dateLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function hourLabel(h: number | null | undefined): string {
  if (h == null) return "";
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * Superlatives across logged walks, with the season and shore filters.
 *
 * Two things this deliberately does not have. There is no fastest-time board —
 * the path is a footpath through other people's front yards and always will be,
 * so nothing here rewards moving quickly past somebody's porch. And nobody
 * appears by name unless they turned on the public register; everyone else is
 * "a walker", because logging a walk is not consent to be on a board.
 */
export function NotableWalks() {
  const [season, setSeason] = useState<string | null>(null);
  const [community, setCommunity] = useState<string | null>(null);
  const { data, isLoading } = usePathNotables(season, community);

  if (isLoading || !data) return null;

  const cards: Array<{ key: string; icon: typeof Flame; label: string; walk: NotableWalk | null; value: string }> = [
    { key: "hottest", icon: Flame, label: "Hottest walk", walk: data.hottest,
      value: data.hottest?.temp_f != null ? `${Math.round(data.hottest.temp_f)}°F` : "" },
    { key: "coldest", icon: Snowflake, label: "Coldest walk", walk: data.coldest,
      value: data.coldest?.temp_f != null ? `${Math.round(data.coldest.temp_f)}°F` : "" },
    { key: "emptiest", icon: Footprints, label: "Quietest walk", walk: data.emptiest, value: "Had it to themselves" },
    { key: "busiest", icon: Users, label: "Busiest walk", walk: data.busiest, value: "Steady traffic" },
    { key: "largest_group", icon: Users, label: "Biggest group", walk: data.largest_group,
      value: data.largest_group?.group_size_band ? GROUP_WORDS[data.largest_group.group_size_band] ?? "" : "" },
    { key: "most_stops", icon: Footprints, label: "Most stops in a day", walk: data.most_stops,
      value: data.most_stops ? `${data.most_stops.stops} stops` : "" },
    { key: "longest_outing", icon: Clock, label: "Longest day on the path", walk: data.longest_outing,
      value: data.longest_outing?.minutes != null ? formatMinutes(data.longest_outing.minutes) : "" },
    { key: "earliest_start", icon: Sunrise, label: "Earliest start", walk: data.earliest_start,
      value: hourLabel(data.earliest_start?.start_hour) },
    { key: "latest_finish", icon: Sunset, label: "Latest finish", walk: data.latest_finish,
      value: hourLabel(data.latest_finish?.end_hour) },
  ].filter((c) => c.walk && c.value);

  const hasAnything = cards.length > 0 || data.linger.length > 0;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-display text-2xl text-slate-900 tracking-tight">Notable walks</h2>
        <p className="text-[11px] text-slate-500">
          {data.total_walks} logged walk{data.total_walks === 1 ? "" : "s"}
        </p>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4 max-w-2xl">
        Superlatives from logged walks. There's no fastest time here and there
        won't be — but the hottest, the quietest and the longest day out are all
        worth knowing before you pick yours. Walkers appear by name only if they
        joined the public register.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SEASONS.map((s) => (
          <FilterChip
            key={s.label}
            active={season === s.value}
            onClick={() => setSeason(s.value)}
            label={s.label}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SHORES.map((s) => (
          <FilterChip
            key={s.label}
            active={community === s.value}
            onClick={() => setCommunity(s.value)}
            label={s.label}
          />
        ))}
      </div>

      {!hasAnything ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            No walks logged {season || community ? "for this filter" : "yet"}. A
            walk needs at least {data.min_stops} stops in one outing before it
            shows up here, so a single stamp on the way past doesn't become a
            record.
          </p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.key} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      {c.label}
                    </p>
                  </div>
                  <p className="font-display text-lg text-slate-900 leading-tight">{c.value}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{walkerLabel(c.walk!)}</p>
                  {c.walk!.on_date && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {dateLabel(c.walk!.on_date)} · {c.walk!.stops} stops
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Where people linger — the closest honest answer to "which stops do
              people actually stop at", derived from the gap between arrivals. */}
          {data.linger.length > 0 && (
            <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Hourglass className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Where people linger
                </p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Median time between arriving at a stop and reaching the next one.
                It's walking time plus however long people stayed — so the stops
                at the top are the ones nobody hurries past.
              </p>
              <ul className="space-y-1.5">
                {data.linger.slice(0, 8).map((l) => (
                  <li key={l.stop_slug} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-900 min-w-0 truncate">
                      {l.stop_name}
                      {l.community && <span className="text-slate-400"> · {l.community}</span>}
                    </span>
                    <span className="text-slate-600 whitespace-nowrap tabular-nums">
                      {l.median_minutes != null ? formatMinutes(l.median_minutes) : "—"}
                      <span className="text-slate-400 text-[11px]"> · {l.samples}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        <Thermometer className="h-3 w-3 inline mr-0.5" />
        Temperature is recorded automatically for the hour of each walk; how busy
        it was is self-reported. Individual walks are never published — only these
        superlatives, and only with a name when the walker asked for one.
      </p>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
