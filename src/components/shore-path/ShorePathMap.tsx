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
  // Geneva Lake silhouette — hand-traced from the real shoreline to read
  // unmistakably as Geneva Lake: long east–west axis, Williams Bay
  // extending NORTH from the north shore, Cedar Point peninsula reaching
  // south and Black Point peninsula reaching north to form the narrows,
  // broad western basin tapering to Fontana's SW tip.
  // viewBox is 200 x 100 (2:1) — matches the lake's real ~4:1 length but
  // gives the bays room to read.
  const lakePath = [
    // East tip (Lake Geneva downtown side)
    "M 192 50",
    // North shore heading west — broad east basin
    "C 188 40, 178 34, 165 33",
    "C 150 32, 138 32, 128 34",
    // Cedar Point peninsula juts SOUTH into the lake
    "C 122 36, 118 42, 114 50",
    "C 110 46, 108 42, 104 38",
    // West side of Cedar Point — Williams Bay opens NORTH
    "C 98 32, 92 26, 88 20",
    "C 86 15, 82 14, 80 18",
    // West shore of Williams Bay back down to main shoreline
    "C 76 22, 72 28, 68 34",
    // Continuing west along north shore
    "C 60 36, 52 38, 44 42",
    // North-west curve toward Fontana
    "C 34 46, 24 50, 18 58",
    // West tip (Fontana point)
    "C 14 64, 14 72, 20 76",
    // South shore heading east from Fontana
    "C 30 82, 50 86, 70 86",
    "C 88 86, 104 82, 116 76",
    // Black Point peninsula juts NORTH into the narrows
    "C 120 72, 124 66, 128 60",
    "C 132 66, 134 72, 138 76",
    // South shore east of Black Point
    "C 152 80, 168 78, 180 70",
    // Return to east tip
    "C 188 64, 192 58, 192 50",
    "Z",
  ].join(" ");

  const visibleStops = stops.filter(
    (s) => s.map_x_pct != null && s.map_y_pct != null,
  );

  const isHero = size === "hero";
  const markerR = isHero ? 3.4 : 2.4;
  const fontSize = isHero ? 3.6 : 2.6;

  return (
    <div
      className={`relative w-full rounded-md border border-slate-200 bg-gradient-to-b from-sky-50 to-stone-50 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 200 100"
        className="block w-full h-auto"
        role="img"
        aria-label="Stylized map of Geneva Lake showing the 21-mile Shore Path with numbered stops"
      >
        {/* Soft land tone behind the lake */}
        <rect width="200" height="100" fill="hsl(45 30% 96%)" />

        {/* Subtle land texture — faint contour lines suggesting hills */}
        <g opacity="0.06" stroke="hsl(30 25% 30%)" strokeWidth="0.3" fill="none">
          <path d="M 0 12 Q 50 8 100 14 T 200 12" />
          <path d="M 0 92 Q 50 96 100 90 T 200 94" />
        </g>

        {/* Lake body with subtle inner glow */}
        <defs>
          <radialGradient id="lakeFill" cx="50%" cy="55%" r="65%">
            <stop offset="0%" stopColor="hsl(200 80% 82%)" />
            <stop offset="100%" stopColor="hsl(205 65% 68%)" />
          </radialGradient>
        </defs>
        <path
          d={lakePath}
          fill="url(#lakeFill)"
          stroke="hsl(205 55% 38%)"
          strokeWidth="0.6"
        />

        {/* Shore Path trace — dashed line just inside the shoreline */}
        <path
          d={lakePath}
          fill="none"
          stroke="hsl(25 75% 42%)"
          strokeWidth="0.7"
          strokeDasharray="1.6 1.4"
          strokeLinecap="round"
          opacity="0.85"
          transform="translate(100 50) scale(0.965) translate(-100 -50)"
        />

        {/* Town labels — placed on land beside the actual shoreline */}
        <g fontFamily="ui-sans-serif, system-ui" fill="hsl(215 28% 28%)">
          <text x="182" y="22" fontSize="3.4" fontWeight="700" textAnchor="middle">
            LAKE GENEVA
          </text>
          <text x="88" y="10" fontSize="3.0" fontWeight="700" textAnchor="middle">
            WILLIAMS BAY
          </text>
          <text x="16" y="52" fontSize="3.0" fontWeight="700" textAnchor="middle">
            FONTANA
          </text>
          <text x="70" y="96" fontSize="3.0" fontWeight="700" textAnchor="middle">
            LINN
          </text>
        </g>

        {/* Peninsula whisper labels */}
        <g fontFamily="ui-sans-serif, system-ui" fill="hsl(205 35% 35%)" opacity="0.75" fontStyle="italic">
          <text x="108" y="52" fontSize="2.0" textAnchor="middle">Cedar Point</text>
          <text x="128" y="58" fontSize="2.0" textAnchor="middle">Black Point</text>
        </g>

        {/* Compass rose */}
        <g transform="translate(8 90)" fill="hsl(215 25% 35%)" opacity="0.6">
          <text x="0" y="0" fontSize="3" fontWeight="700" textAnchor="middle">N</text>
          <path d="M 0 1 L -1.5 5 L 0 4 L 1.5 5 Z" />
        </g>

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
                  r={markerR + 2.2}
                  fill="hsl(25 80% 55% / 0.25)"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={markerR}
                fill={isActive ? "hsl(25 85% 50%)" : "hsl(215 70% 35%)"}
                stroke="white"
                strokeWidth="0.7"
              />
              <text
                x={x}
                y={y + fontSize / 3.2}
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