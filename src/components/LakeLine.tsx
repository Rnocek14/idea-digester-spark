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
  // Quiet wave: ~1.3px amplitude, soft blue, thin stroke.
  const wave = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='4' viewBox='0 0 80 4' preserveAspectRatio='none'>
      <path d='M0 2 Q 20 0.7, 40 2 T 80 2' fill='none' stroke='rgba(96,150,200,0.55)' stroke-width='1' stroke-linecap='round'/>
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
          /* Sit just below the header so the soft glow can hang underneath */
          top: 100%;
          height: 12px;
          overflow: hidden;
          pointer-events: none;
        }
        .lake-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(125,170,210,0.18), transparent);
        }
        .lake-wave-track {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 4px;
          background-image: ${bg};
          background-repeat: repeat-x;
          background-size: 80px 4px;
          transform: translateX(0);
          will-change: transform;
        }
        /* Desktop only — water gently wakes up on header hover */
        @media (hover: hover) and (pointer: fine) {
          header:hover .lake-wave-track {
            animation: lake-drift var(--lake-speed, 16s) linear infinite;
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
        <div className="lake-glow" />
      </div>
    </>
  );
}

export default LakeLine;