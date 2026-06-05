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
      <path d='M0 2 Q 20 0.7, 40 2 T 80 2' fill='none' stroke='rgba(82,140,195,0.65)' stroke-width='1' stroke-linecap='round'/>
    </svg>`
  );
  const bg = `url("data:image/svg+xml,${wave}")`;

  // Tiny wooden runabout silhouette — classic Lake Geneva Streblow.
  // 56x20 viewBox; mahogany hull, cream sheer stripe, pale-blue windshield.
  const boat = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='20' viewBox='0 0 56 20'>
      <!-- hull -->
      <path d='M3 10 Q 6 16, 14 16.5 L 46 16.5 Q 52 16, 54 11 L 50 10 Z'
            fill='#8a4a22' stroke='#4a2410' stroke-width='0.6' stroke-linejoin='round'/>
      <!-- cream sheer stripe -->
      <path d='M5 10.2 L 51 10.2' stroke='#f1e4cb' stroke-width='1' stroke-linecap='round'/>
      <!-- waterline shadow -->
      <path d='M3 10 L 54 10' stroke='#3a1e0e' stroke-width='0.4' opacity='0.5'/>
      <!-- windshield -->
      <path d='M22 10 L 28 5 L 38 5 L 40 10 Z'
            fill='#bcd6ea' stroke='#5a87aa' stroke-width='0.6' stroke-linejoin='round'/>
      <path d='M30 5 L 30 10 M 34 5 L 34 10' stroke='#5a87aa' stroke-width='0.4'/>
      <!-- bow flag/cap -->
      <circle cx='51' cy='9.5' r='0.6' fill='#b8331f'/>
    </svg>`
  );
  const boatBg = `url("data:image/svg+xml,${boat}")`;

  return (
    <>
      <style>{`
        .lake-line {
          position: absolute;
          left: 0;
          right: 0;
          /* Sit just below the header so the soft glow can hang underneath */
          top: 100%;
          height: 20px;
          overflow: hidden;
          pointer-events: none;
        }
        .lake-boat-layer {
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          height: 0;
          pointer-events: none;
          z-index: 1;
        }
        .lake-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom,
            rgba(110,165,210,0.32) 0%,
            rgba(120,170,210,0.22) 25%,
            rgba(130,175,210,0.12) 55%,
            rgba(140,180,215,0.04) 85%,
            transparent 100%);
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
        .lake-boat {
          position: absolute;
          top: -16px;
          left: 0;
          width: 56px;
          height: 20px;
          background-image: ${boatBg};
          background-repeat: no-repeat;
          background-size: 56px 20px;
          opacity: 0.9;
          transform: translateX(8vw);
          will-change: transform;
        }
        /* Desktop only — water gently wakes up on header hover */
        @media (hover: hover) and (pointer: fine) {
          header:hover .lake-wave-track {
            animation: lake-drift var(--lake-speed, 16s) linear infinite;
          }
          header:hover .lake-boat {
            animation: lake-boat-drift 48s linear infinite, lake-boat-bob 6s ease-in-out infinite;
          }
        }
        @keyframes lake-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes lake-boat-drift {
          from { left: -40px; }
          to   { left: 100%; }
        }
        @keyframes lake-boat-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lake-wave-track { animation: none !important; }
          .lake-boat { animation: none !important; }
        }
      `}</style>
      <div className="lake-line" aria-hidden="true">
        <div className="lake-wave-track" />
        <div className="lake-glow" />
      </div>
      <div className="lake-boat-layer" aria-hidden="true">
        <div className="lake-boat" />
      </div>
    </>
  );
}

export default LakeLine;