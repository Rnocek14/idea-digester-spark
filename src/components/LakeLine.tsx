import React from "react";
import boatImg from "@/assets/streblow-boat.png";

/**
 * Lake Icon config — the little object that sits on the waterline.
 * Swap by changing this one object. Add `href` later when there's a real
 * article to link to; until then the icon is decorative (no link, no cursor).
 */
type LakeIcon = {
  src: string;
  label: string;   // short name shown in tooltip
  tooltip: string; // full tooltip text
  href?: string;   // optional — when set, icon becomes a link
  width: number;
  height: number;
};

const currentIcon: LakeIcon = {
  src: boatImg,
  label: "Streblow Runabout",
  tooltip: "Lake Icon: Streblow Runabout",
  href: "/guides/streblow-boats-geneva-lake",
  width: 62,
  height: 19,
};

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

  const boatBg = `url("${currentIcon.src}")`;
  const boatW = `${currentIcon.width}px`;
  const boatH = `${currentIcon.height}px`;

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
          top: -20px;
          right: 2.5vw;
          width: ${boatW};
          height: ${boatH};
          background-image: ${boatBg};
          background-repeat: no-repeat;
          background-size: ${boatW} ${boatH};
          opacity: 0.85;
          will-change: transform;
          pointer-events: auto;
        }
        /* Desktop only — water gently wakes up on header hover */
        @media (hover: hover) and (pointer: fine) {
          header:hover .lake-wave-track {
            animation: lake-drift var(--lake-speed, 16s) linear infinite;
          }
          header:hover .lake-boat {
            animation: lake-boat-bob 5s ease-in-out infinite;
          }
        }
        @keyframes lake-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes lake-boat-bob {
          0%, 100% { transform: translateY(0) rotate(-0.4deg); }
          50%      { transform: translateY(-1.5px) rotate(0.4deg); }
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
        {currentIcon.href ? (
          <a
            href={currentIcon.href}
            className="lake-boat"
            aria-label={currentIcon.label}
            title={currentIcon.tooltip}
          />
        ) : (
          <div
            className="lake-boat"
            role="img"
            aria-label={currentIcon.label}
            title={currentIcon.tooltip}
          />
        )}
      </div>
    </>
  );
}

export default LakeLine;