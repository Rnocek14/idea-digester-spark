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
  // Geneva Lake silhouette — vector-traced from a reference photo of the
  // real shoreline. Reads unmistakably as Geneva Lake: long east–west
  // axis, Williams Bay extending NORTH, Cedar Point peninsula reaching
  // south, Black Point peninsula reaching north into the narrows,
  // broad eastern basin, tapered western Fontana tip.
  // viewBox is 200 × 100; coordinates fitted to fill the canvas with
  // a 4-unit margin on all sides.
  const lakePath = "M 185.51 7.12 C 185.10 7.23, 184.37 7.55, 183.89 7.84 C 183.40 8.12, 182.70 8.51, 182.32 8.70 C 181.37 9.18, 180.91 9.78, 180.30 11.31 C 179.48 13.42, 178.13 15.10, 175.40 17.42 C 173.92 18.68, 173.38 19.76, 173.07 22.03 C 172.73 24.51, 172.39 24.89, 169.08 26.52 C 166.54 27.77, 164.82 28.89, 160.89 31.88 C 158.72 33.51, 158.08 33.84, 155.63 34.55 C 152.29 35.54, 150.50 36.66, 149.68 38.34 C 149.48 38.73, 149.44 38.74, 148.60 38.74 C 147.58 38.74, 145.76 39.60, 144.62 40.58 C 143.89 41.23, 143.45 41.33, 140.69 41.45 C 136.54 41.62, 135.58 41.80, 134.58 42.56 C 134.09 42.94, 134.05 42.94, 132.24 42.94 C 130.40 42.94, 130.40 42.94, 128.67 43.81 C 126.06 45.14, 124.95 45.10, 123.15 43.58 C 122.00 42.62, 118.87 41.38, 117.60 41.38 C 116.66 41.37, 116.00 41.04, 114.89 40.06 C 113.77 39.06, 113.26 38.88, 109.86 38.22 C 106.21 37.50, 106.09 37.49, 102.09 37.12 C 97.52 36.70, 96.49 36.53, 94.37 35.81 C 90.83 34.63, 88.69 35.00, 87.57 36.99 C 87.38 37.30, 86.87 37.62, 85.19 38.45 C 82.92 39.56, 82.43 39.95, 81.65 41.29 C 81.23 42.00, 80.74 42.30, 79.67 42.46 C 78.54 42.65, 77.21 43.38, 74.95 45.09 C 70.88 48.14, 68.94 49.82, 67.90 51.17 C 66.53 52.94, 65.10 53.27, 63.81 52.10 C 62.52 50.93, 62.31 49.26, 63.02 45.77 C 63.29 44.45, 63.30 44.18, 63.16 43.27 C 63.08 42.72, 63.02 41.91, 63.02 41.48 C 63.02 40.39, 62.37 34.53, 62.18 33.96 C 61.95 33.24, 61.22 32.54, 60.22 32.08 C 56.93 30.58, 50.20 30.98, 49.09 32.76 C 48.78 33.23, 48.78 33.15, 49.04 36.76 C 49.24 39.64, 48.33 44.06, 46.86 47.40 C 45.93 49.49, 45.52 50.90, 45.24 53.08 C 44.82 56.40, 44.64 56.94, 43.95 57.04 C 43.32 57.13, 42.91 56.85, 40.98 54.97 C 38.42 52.47, 37.80 52.12, 35.84 52.14 C 33.87 52.17, 28.81 53.17, 27.07 53.89 C 21.28 56.27, 13.26 62.76, 11.98 66.12 C 11.58 67.15, 11.18 67.58, 9.76 68.49 C 7.75 69.77, 6.47 71.67, 5.28 75.17 C 5.05 75.87, 4.47 77.25, 4.00 78.24 C 2.08 82.27, 2.12 83.96, 4.24 89.23 C 5.28 91.84, 5.61 92.37, 6.51 92.88 C 8.33 93.91, 11.19 93.74, 13.96 92.47 C 15.65 91.70, 15.76 91.68, 18.47 91.55 C 21.72 91.42, 22.37 91.15, 23.27 89.55 C 23.75 88.70, 23.78 88.69, 25.71 89.19 C 27.35 89.62, 28.62 89.59, 29.66 89.11 C 30.32 88.81, 30.32 88.81, 32.43 89.27 C 37.22 90.28, 42.37 89.67, 47.47 87.50 C 48.62 87.01, 48.62 87.01, 50.98 87.01 C 53.62 87.01, 53.32 87.07, 62.91 84.97 C 69.61 83.51, 71.03 83.28, 72.40 83.43 C 74.43 83.66, 75.78 83.31, 76.55 82.33 C 77.54 81.09, 78.31 80.45, 80.32 79.21 C 84.19 76.82, 84.82 75.94, 86.32 71.00 C 87.37 67.61, 87.81 67.02, 89.91 66.26 C 92.34 65.37, 92.77 65.38, 95.98 66.49 C 98.24 67.26, 98.24 67.26, 100.39 67.31 C 104.21 67.41, 109.00 66.68, 111.74 65.58 C 112.63 65.22, 112.91 65.18, 114.20 65.18 C 115.99 65.18, 117.04 64.93, 118.65 64.15 C 119.81 63.58, 120.41 63.16, 122.68 61.31 C 123.23 60.86, 124.65 59.96, 125.83 59.30 C 129.10 57.48, 131.43 56.05, 132.10 55.44 C 134.43 53.31, 136.36 54.16, 139.04 58.47 C 140.39 60.63, 140.61 60.80, 142.04 60.73 C 144.65 60.61, 144.81 60.62, 145.73 61.11 C 147.25 61.92, 148.96 64.04, 149.80 66.15 C 150.42 67.69, 152.07 68.81, 153.45 68.62 C 154.86 68.43, 154.99 68.46, 156.28 69.27 C 157.94 70.33, 158.35 70.48, 159.75 70.56 C 162.04 70.68, 164.43 69.79, 167.66 67.58 C 168.59 66.96, 170.05 66.03, 170.91 65.51 C 171.76 65.00, 173.03 64.16, 173.73 63.66 C 177.18 61.16, 179.72 59.75, 181.52 59.36 C 183.14 59.00, 183.47 58.85, 184.40 58.00 C 185.24 57.23, 185.68 57.10, 188.29 56.94 C 191.31 56.75, 191.46 56.46, 191.74 50.07 C 192.00 44.34, 191.63 43.34, 188.46 41.10 C 187.71 40.57, 187.00 39.95, 186.85 39.72 C 186.36 38.92, 186.56 37.27, 187.47 34.62 C 187.66 34.07, 187.94 33.08, 188.09 32.44 C 188.24 31.78, 188.59 30.84, 188.89 30.28 C 189.19 29.73, 189.70 28.71, 190.04 28.01 C 190.85 26.32, 191.48 25.49, 192.25 25.09 C 193.94 24.21, 194.72 22.87, 195.18 19.99 C 195.28 19.26, 195.66 17.84, 196.00 16.83 C 196.89 14.19, 196.76 13.34, 195.18 11.53 C 194.78 11.08, 194.43 10.55, 194.38 10.38 C 194.27 9.95, 193.97 9.85, 193.28 10.01 C 192.53 10.19, 192.15 9.96, 191.66 9.04 C 191.12 8.03, 190.75 7.66, 189.93 7.30 C 189.02 6.89, 186.66 6.80, 185.51 7.12 Z";

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

        {/* Shore Path trace — dashed line sitting directly on the shoreline.
            We draw it on top of the lake outline (no transform) so it tracks
            every cove and peninsula exactly instead of drifting inward. */}
        <path
          d={lakePath}
          fill="none"
          stroke="hsl(25 75% 42%)"
          strokeWidth="0.9"
          strokeDasharray="1.6 1.4"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Four town anchors — quiet, recognizable, never per-stop labels.
            Stop names appear on hover/tap via the marker <title> tooltip. */}
        <g fontFamily="ui-sans-serif, system-ui" fill="hsl(215 28% 28%)">
          <text x="198" y="5" fontSize="3.2" fontWeight="700" textAnchor="end" letterSpacing="0.2">
            LAKE GENEVA
          </text>
          <text x="52" y="22" fontSize="2.8" fontWeight="700" textAnchor="middle" letterSpacing="0.2">
            WILLIAMS BAY
          </text>
          <text x="6" y="55" fontSize="2.6" fontWeight="700" textAnchor="start" letterSpacing="0.2">
            FONTANA
          </text>
          <text x="75" y="98" fontSize="2.8" fontWeight="700" textAnchor="middle" letterSpacing="0.2">
            LINN
          </text>
        </g>

        {/* Compass rose */}
        <g transform="translate(195 95)" fill="hsl(215 25% 35%)" opacity="0.55">
          <text x="0" y="0" fontSize="2.6" fontWeight="700" textAnchor="middle">N</text>
          <path d="M 0 0.6 L -1.2 4 L 0 3.2 L 1.2 4 Z" />
        </g>

        {/* Stop markers */}
        {visibleStops.map((stop) => {
          const x = stop.map_x_pct!;
          const y = stop.map_y_pct!;
          const isActive = stop.id === activeStopId;
          return (
            <g
              key={stop.id}
              className={onStopClick ? "cursor-pointer group" : "group"}
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
              {/* Hover ring (desktop) — invisible until the marker is hovered */}
              <circle
                cx={x}
                cy={y}
                r={markerR + 1.8}
                fill="hsl(25 80% 55% / 0.35)"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
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