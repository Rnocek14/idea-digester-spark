import React from "react";

/**
 * LakeLine — a barely-there SVG wave that sits flush at the bottom of the
 * sticky header in place of a flat border. Soft lake blue. Static by default;
 * gently drifts on header hover. Disabled under prefers-reduced-motion.
 *
 * Future hook: amplitude and speed are driven by CSS vars (--lake-amplitude,
 * --lake-speed) so a weather hook can later set rougher waters without any
 * component refactor.
 */
export function LakeLine() {
  // One wave cycle = 80px wide. Tiled across full header width via <pattern>.
  return (
    <>
      <style>{`
        .lake-line { pointer-events: none; }
        .lake-line .wave-pattern { transform-origin: 0 0; }
        header:hover .lake-line .wave-pattern {
          animation: lake-drift var(--lake-speed, 12s) linear infinite;
        }
        @keyframes lake-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-80px); }
        }
        @media (prefers-reduced-motion: reduce) {
          header:hover .lake-line .wave-pattern { animation: none; }
        }
      `}</style>
      <svg
        className="lake-line absolute inset-x-0 bottom-0 h-1 w-full"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="lake-wave"
            x="0"
            y="0"
            width="80"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <g className="wave-pattern">
              {/* Two tiles side-by-side so the drift animation reads seamlessly */}
              <path
                d="M0 2 Q 20 0, 40 2 T 80 2 T 120 2 T 160 2"
                fill="none"
                stroke="rgba(125, 170, 210, 0.55)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lake-wave)" />
      </svg>
    </>
  );
}

export default LakeLine;