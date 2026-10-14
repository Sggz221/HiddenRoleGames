/**
 * Decorative night landscape for the home page: stars, fog, a pine forest and a wolf howling
 * on a rock. The moon is a separate element (`Moon`) so it can be placed per breakpoint. Purely visual (aria-hidden); every animation is `motion-safe` only.
 */

/** Deterministic pseudo-random sequence so the sky looks the same on every render. */
function sequence(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const next = sequence(7);
const STARS = Array.from({ length: 70 }, (_, index) => ({
  x: next() * 1200,
  y: next() * 380,
  r: 0.6 + next() * 1.4,
  delay: (next() * 6).toFixed(2),
  bright: index % 7 === 0,
}));

/** Pine silhouette: three stacked triangles on a trunk, `h` tall with its base at `y`. */
function pine(x: number, y: number, h: number) {
  const w = h * 0.42;
  const tiers = [0, 0.3, 0.55].map((offset, tier) => {
    const top = y - h + offset * h;
    const bottom = top + h * (0.45 + tier * 0.05);
    const half = (w / 2) * (0.6 + tier * 0.25);
    return `M${x} ${top} L${x + half} ${bottom} L${x - half} ${bottom} Z`;
  });
  const trunk = `M${x - h * 0.03} ${y} h${h * 0.06} v${-h * 0.12} h${-h * 0.06} Z`;
  return [...tiers, trunk].join(" ");
}

const FAR_TREES = [40, 95, 150, 230, 300, 380, 450, 860, 920, 990, 1060, 1120, 1180]
  .map((x, i) => pine(x, 500 - (i % 3) * 6, 70 + ((i * 37) % 40)))
  .join(" ");
const NEAR_TREES = [0, 70, 130, 1010, 1080, 1150, 1210]
  .map((x, i) => pine(x, 560, 130 + ((i * 53) % 60)))
  .join(" ");

/** Seated wolf, muzzle raised to the moon (drawn facing right, ~100 units tall). */
const WOLF =
  "M0 100 C2 92 8 86 16 84 C12 80 12 74 16 70 C20 62 26 50 30 40 C32 32 34 26 38 20 " +
  "L36 10 L42 16 L44 6 L48 15 C52 12 58 8 64 2 L66 6 C62 12 58 18 54 22 C56 30 56 40 54 50 " +
  "C56 62 58 76 58 92 L62 98 L54 100 L52 92 C50 86 48 82 46 80 C44 86 44 92 46 98 L40 100 Z";

export function NightScene() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id="ground-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05070f" stopOpacity="0" />
          <stop offset="100%" stopColor="#05070f" />
        </linearGradient>
      </defs>

      <g>
        {STARS.map((star) => (
          <circle
            key={`${star.x}-${star.y}`}
            cx={star.x}
            cy={star.y}
            r={star.bright ? star.r + 0.6 : star.r}
            fill="#e7e4f2"
            opacity={star.bright ? 0.9 : 0.55}
            className="motion-safe:animate-twinkle"
            style={{ animationDelay: `${star.delay}s` }}
          />
        ))}
      </g>

      <path d="M0 470 Q300 400 620 450 T1200 430 V600 H0 Z" fill="#11172b" />
      <path d={FAR_TREES} fill="#0d1224" />

      <g className="motion-safe:animate-fog-slow" opacity="0.5">
        <ellipse cx="300" cy="500" rx="420" ry="34" fill="#9b98b3" opacity="0.12" />
        <ellipse cx="950" cy="480" rx="380" ry="28" fill="#9b98b3" opacity="0.1" />
      </g>

      <path d="M500 600 L545 500 Q600 466 680 476 L760 512 L830 600 Z" fill="#080b17" />
      <g transform="translate(572 330) scale(1.5)">
        <path
          d={WOLF}
          fill="#080b17"
          stroke="#f4e9c8"
          strokeOpacity="0.22"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </g>
      <path d={NEAR_TREES} fill="#070a14" />
      <path d="M0 540 Q400 500 800 540 T1200 530 V600 H0 Z" fill="#070a14" />

      <g className="motion-safe:animate-fog" opacity="0.55">
        <ellipse cx="200" cy="570" rx="380" ry="30" fill="#9b98b3" opacity="0.1" />
        <ellipse cx="1000" cy="580" rx="360" ry="26" fill="#9b98b3" opacity="0.1" />
      </g>
      <rect y="480" width="1200" height="120" fill="url(#ground-fade)" />
    </svg>
  );
}

/** Full moon with a slow halo; positioned by the caller. */
export function Moon({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <div className="relative size-full rounded-full bg-[radial-gradient(circle_at_40%_38%,#fffaf0,#e6d7ab)] shadow-[0_0_60px_10px_rgb(244_233_200/0.18)] motion-safe:animate-moon-glow">
        <span className="absolute top-[24%] left-[22%] size-[18%] rounded-full bg-[#d9c894]/45" />
        <span className="absolute top-[58%] left-[58%] size-[13%] rounded-full bg-[#d9c894]/40" />
        <span className="absolute top-[18%] left-[62%] size-[9%] rounded-full bg-[#d9c894]/35" />
        <span className="absolute top-[66%] left-[34%] size-[7%] rounded-full bg-[#d9c894]/30" />
      </div>
    </div>
  );
}
