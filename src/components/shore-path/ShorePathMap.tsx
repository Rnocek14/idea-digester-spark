import { useMemo } from "react";

export type ShorePathStop = {
  id: string;
  order_index: number;
  slug: string;
  name: string;
  short_label?: string | null;
  map_x_pct?: number | null;
  map_y_pct?: number | null;
};

type Props = {
  stops: ShorePathStop[];
  /** Highlighted stop (Walking Mode current position). */
  activeStopId?: string | null;
  /** Click handler — used both for in-page anchor scroll and Walking Mode. */
  onStopClick?: (stop: ShorePathStop) => void;
  /** Visual size variant. */
  size?: "hero" | "mini";
  className?: string;
};

/**
 * Stylized illustrated map of Geneva Lake with the Shore Path traced
 * around the shoreline and numbered stop markers placed at percentage
 * coordinates supplied by the database.
 *
 * Intentionally NOT a satellite or Google map — the silhouette IS the
 * brand asset for this page. The shoreline path is a smooth closed
 * curve approximating the real lake outline; precise GIS accuracy is
 * not the goal here.
 */
export function ShorePathMap({
  stops,
  activeStopId,
  onStopClick,
  size = "hero",
  className = "",
}: Props) {
  // Lake silhouette — approximated, hand-tuned to evoke Geneva Lake's
  // long east-west axis and Williams Bay notch on the north shore.
  const lakePath = useMemo(
    () =>
      [
        "M 78 38", // start near Lake Geneva (east end)
        "C 72 32, 60 30, 50 33", // north shore heading west
        "C 44 35, 40 40, 42 46", // Williams Bay notch begins
        "C 44 50, 48 49, 50 46", // pinch back south (bay)
        "C 52 43, 56 44, 58 47", // back out around the bay
        "C 50 50, 35 52, 25 60", // sweep south-west to Fontana
        "C 18 65, 18 72, 26 76", // west end (Fontana tip)
        "C 35 80, 50 82, 65 78", // south shore heading east
        "C 75 76, 82 70, 84 60", // east-side curve up
        "C 86 50, 84 42, 78 38", // back to start
        "Z",
      ].join(" "),
    [],
  );

  const visibleStops = stops.filter(
    (s) => s.map_x_pct != null && s.map_y_pct != null,
  );

  const isHero = size === "hero";
  const markerR = isHero ? 2.6 : 1.8;
  const fontSize = isHero ? 2.6 : 1.8;

  return (
    <div
      className={`relative w-full rounded-md border border-slate-200 bg-gradient-to-b from-sky-50 to-stone-50 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="block w-full h-auto"
        role="img"
        aria-label="Stylized map of Geneva Lake showing the 21-mile Shore Path with numbered stops"
      >
        {/* Soft land tone behind the lake */}
        <rect width="100" height="100" fill="hsl(45 30% 96%)" />

        {/* Lake body */}
        <path
          d={lakePath}
          fill="hsl(205 75% 78%)"
          stroke="hsl(205 55% 45%)"
          strokeWidth="0.4"
          opacity={0.95}
        />

        {/* Shore Path trace — a dashed line just inside the shoreline */}
        <path
          d={lakePath}
          fill="none"
          stroke="hsl(25 70% 45%)"
          strokeWidth="0.55"
          strokeDasharray="1.2 1.2"
          strokeLinecap="round"
          transform="translate(0 0) scale(0.985) translate(0.75 0.75)"
        />

        {/* Town labels */}
        <text x="80" y="36" fontSize="2.2" fontWeight="600" fill="hsl(215 25% 30%)">
          Lake Geneva
        </text>
        <text x="40" y="44" fontSize="2.0" fontWeight="600" fill="hsl(215 25% 30%)">
          Williams Bay
        </text>
        <text x="18" y="73" fontSize="2.0" fontWeight="600" fill="hsl(215 25% 30%)">
          Fontana
        </text>
        <text x="58" y="86" fontSize="2.0" fontWeight="600" fill="hsl(215 25% 30%)">
          Linn
        </text>

        {/* Stop markers */}
        {visibleStops.map((stop) => {
          const x = stop.map_x_pct!;
          const y = stop.map_y_pct!;
          const isActive = stop.id === activeStopId;
          return (
            <g
              key={stop.id}
              className={onStopClick ? "cursor-pointer" : undefined}
              onClick={onStopClick ? () => onStopClick(stop) : undefined}
            >
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={markerR + 1.8}
                  fill="hsl(25 80% 55% / 0.25)"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={markerR}
                fill={isActive ? "hsl(25 85% 50%)" : "hsl(215 70% 35%)"}
                stroke="white"
                strokeWidth="0.5"
              />
              <text
                x={x}
                y={y + fontSize / 3}
                fontSize={fontSize}
                fontWeight="700"
                fill="white"
                textAnchor="middle"
                pointerEvents="none"
              >
                {stop.order_index}
              </text>
              {onStopClick && (
                <title>{`${stop.order_index}. ${stop.name}`}</title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}