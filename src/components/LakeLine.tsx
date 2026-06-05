import React from "react";

/**
 * LakeLine — a soft lake-blue SVG wave at the bottom of the sticky header.
 * Static by default; on desktop header hover, the wave track slides left to
 * read as drifting water. Mobile + prefers-reduced-motion stay static.
 *
 * Structure: a real child <div class="lake-line"> with an inner
 * .lake-wave-track that is 200% wide. We animate translateX(-50%) on the
 * track so one full repeat of the wave passes through the viewport and the
 * loop is seamless.
 */
export function LakeLine() {
  // Single wave tile encoded as a URL so we can repeat-x it on the track.
  // Tile is 80x6; amplitude ~2.5px; stroke 1.5 in soft lake blue.
  const wave = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='6' viewBox='0 0 80 6' preserveAspectRatio='none'>
      <path d='M0 3 Q 20 0.4, 40 3 T 80 3' fill='none' stroke='rgba(96,150,200,0.7)' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`
  );
  const bg = `url("data:image/svg+xml,${wave}")`;

  return (
    <>
      <style>{`
        .lake-line {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 6px;
          overflow: hidden;
          pointer-events: none;
        }
        .lake-wave-track {
          width: 200%;
          height: 100%;
          background-image: ${bg};
          background-repeat: repeat-x;
          background-size: 80px 6px;
          transform: translateX(0);
          transition: transform 0s;
          will-change: transform;
        }
        /* Desktop only — animate on header hover */
        @media (hover: hover) and (pointer: fine) {
          header:hover .lake-wave-track {
            animation: lake-drift var(--lake-speed, 8s) linear infinite;
          }
        }
        @keyframes lake-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lake-wave-track { animation: none !important; }
        }
      `}</style>
      <div className="lake-line" aria-hidden="true">
        <div className="lake-wave-track" />
      </div>
    </>
  );
}

export default LakeLine;