/** Deterministic star field (same sky on every render and device). */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 7919) % 1600;
  const y = (i * 104729) % 420;
  const r = 0.6 + ((i * 31) % 10) / 10;
  return { x, y, r, delay: (i % 7) * 0.6 };
});

/** Sun and moon move by `transform` (composited), from the clock's viewport coordinates. */
const SUN_AT = "translate3d(var(--sun-x, 50vw), var(--sun-y, 70vh), 0)";
const MOON_AT = "translate3d(var(--moon-x, 50vw), var(--moon-y, 20vh), 0)";

/**
 * The village behind the game, painted with the clock's colours (CSS variables written by
 * `useGameClock`): sky gradient, stars, sun and moon on their arcs, hills, a pine and the
 * house whose windows light up at night. Purely decorative.
 */
export function Landscape() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, var(--sky-top), var(--sky-bottom) 72%)" }}
      />
      {/* Warm haze around the sun at dawn and dusk. */}
      <div
        className="absolute top-0 left-0 size-[60vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl will-change-transform"
        style={{
          transform: SUN_AT,
          background: "radial-gradient(circle, var(--glow), transparent 65%)",
          opacity: "calc(var(--sun-up) * 0.7)",
        }}
      />
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMax slice"
      >
        <g style={{ opacity: "var(--stars)" }}>
          {STARS.map((star) => (
            <circle
              key={`${star.x}-${star.y}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#f4e9c8"
              className="motion-safe:animate-twinkle"
              style={{ animationDelay: `${star.delay}s` }}
            />
          ))}
        </g>
      </svg>

      <div
        className="absolute top-0 left-0 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fde68a] shadow-[0_0_80px_30px_rgb(253_230_138/0.45)] will-change-transform sm:size-24"
        style={{ transform: SUN_AT, opacity: "var(--sun-up)" }}
      />
      <div
        className="absolute top-0 left-0 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moon shadow-[0_0_50px_10px_rgb(244_233_200/0.25)] will-change-transform sm:size-20"
        style={{ transform: MOON_AT, opacity: "var(--moon-up)" }}
      >
        <span className="absolute top-[22%] left-[30%] size-[18%] rounded-full bg-black/10" />
        <span className="absolute top-[55%] left-[55%] size-[12%] rounded-full bg-black/10" />
      </div>

      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        viewBox="0 0 1600 560"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <filter id="window-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* Far hills, then the near hill the village stands on. */}
        <path
          d="M0 300 C 300 230 520 270 800 240 S 1300 210 1600 260 V560 H0Z"
          style={{ fill: "var(--land)", opacity: 0.55 }}
        />
        <path d="M0 380 C 400 300 1000 300 1600 360 V560 H0Z" style={{ fill: "var(--land)" }} />

        {/* Pine on the left. */}
        <g style={{ fill: "var(--land)" }} transform="translate(250 175)">
          <path d="M60 0 L105 70 H85 L125 135 H100 L145 205 H-25 L20 135 H-5 L35 70 H15Z" />
          <rect x="48" y="200" width="24" height="40" />
        </g>
        <g style={{ fill: "var(--land)", opacity: 0.8 }} transform="translate(120 235) scale(0.6)">
          <path d="M60 0 L105 70 H85 L125 135 H100 L145 205 H-25 L20 135 H-5 L35 70 H15Z" />
        </g>

        {/* The house on the right, with windows that glow at night. */}
        <g transform="translate(1150 190)">
          <path d="M-30 110 L130 0 L290 110Z" style={{ fill: "var(--land)" }} />
          <rect x="0" y="105" width="260" height="150" style={{ fill: "var(--land)" }} />
          <rect x="190" y="20" width="26" height="60" style={{ fill: "var(--land)" }} />
          <g style={{ opacity: "var(--windows)" }}>
            <rect x="30" y="135" width="46" height="40" fill="#ffc46b" filter="url(#window-glow)" />
            <rect x="30" y="135" width="46" height="40" fill="#ffd28a" />
            <rect
              x="180"
              y="135"
              width="46"
              height="40"
              fill="#ffc46b"
              filter="url(#window-glow)"
            />
            <rect x="180" y="135" width="46" height="40" fill="#ffd28a" />
          </g>
          <rect x="108" y="175" width="44" height="80" rx="4" fill="rgb(0 0 0 / 0.35)" />
        </g>
      </svg>

      {/* Low fog drifting over the hills (still with reduced motion). */}
      <div className="absolute inset-x-[-10%] bottom-[8%] h-32 bg-gradient-to-t from-white/5 to-transparent blur-xl motion-safe:animate-fog" />
    </div>
  );
}
