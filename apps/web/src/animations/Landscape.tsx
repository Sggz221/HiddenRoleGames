import type { CSSProperties } from "react";

/** Deterministic star field (same sky on every render and device). */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 7919) % 1600;
  const y = (i * 104729) % 420;
  const r = 0.6 + ((i * 31) % 10) / 10;
  return { x, y, r, delay: (i % 7) * 0.6 };
});

/** Repeatable noise in [0, 1): the scenery is identical on every render and device. */
const noise = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const fill = (part: string): CSSProperties => ({ fill: `var(--sc-${part})` });

/** Height of the far ridge at `x` (land coordinates, 1600 × 560). */
const ridgeY = (x: number) => 236 + 20 * Math.sin(x / 260) + 11 * Math.sin(x / 97 + 1);

const RIDGE = `M0 ${ridgeY(0)} ${Array.from({ length: 81 }, (_, i) => `L${i * 20} ${ridgeY(i * 20).toFixed(1)}`).join(" ")} V560 H0Z`;

/** The forest on the far ridge: one path of thin, hazy pines. */
const FAR_PINES = Array.from({ length: 110 }, (_, i) => {
  const x = i * 14.6 + noise(i, 1) * 8;
  const h = 24 + noise(i, 2) * 34;
  const w = h * 0.4;
  const base = ridgeY(x) + 10;
  return `M${(x - w / 2).toFixed(1)} ${base.toFixed(1)} L${x.toFixed(1)} ${(base - h).toFixed(1)} L${(x + w / 2).toFixed(1)} ${base.toFixed(1)}Z`;
}).join(" ");

/** A pine in three tiers, `h` tall, standing on (x, base); `shade` keeps only its right half. */
const pinePath = (x: number, base: number, h: number, shade = false) => {
  const w = h * 0.5;
  const tier = (top: number, bottom: number, half: number) =>
    `M${(shade ? x : x - half).toFixed(1)} ${bottom.toFixed(1)} L${x.toFixed(1)} ${top.toFixed(1)} L${(x + half).toFixed(1)} ${bottom.toFixed(1)}Z`;
  return [
    tier(base - h, base - h * 0.55, w * 0.32),
    tier(base - h * 0.75, base - h * 0.28, w * 0.42),
    tier(base - h * 0.5, base - h * 0.06, w * 0.5),
  ].join(" ");
};

/**
 * The near forest: tall pines on both sides of the clearing and a lower tree line behind
 * the village, so the house still stands out against the meadow.
 */
const NEAR_FOREST = Array.from({ length: 70 }, (_, i) => {
  const x = i * 23 + noise(i, 3) * 14;
  const clearing = x > 560 && x < 1200;
  const h = clearing ? 46 + noise(i, 4) * 30 : 80 + noise(i, 4) * 70;
  return pinePath(x, 338 + noise(i, 5) * 10, h);
}).join(" ");

/** Grass tufts over the meadow and the foreground, smaller in the distance. */
const TUFTS = Array.from({ length: 150 }, (_, i) => {
  const y = 340 + noise(i, 6) ** 0.8 * 215;
  const x = noise(i, 7) * 1600;
  const s = 0.45 + ((y - 340) / 215) * 0.9;
  const blade = (dx: number, h: number) => `M${x.toFixed(1)} ${y.toFixed(1)} l${dx * s} ${-h * s}`;
  return { light: i % 3 === 0, d: [blade(-4, 9), blade(0.5, 13), blade(4, 8)].join(" ") };
});
const DARK_TUFTS = TUFTS.filter((t) => !t.light)
  .map((t) => t.d)
  .join(" ");
const LIGHT_TUFTS = TUFTS.filter((t) => t.light)
  .map((t) => t.d)
  .join(" ");

/** Pebbles along the edges of the main path. */
const PEBBLES = Array.from({ length: 16 }, (_, i) => {
  const t = i / 15;
  const left = i % 2 === 0;
  // Roughly along the path's edges, from the foreground up to the door.
  const x = left ? 650 + t * 335 : 868 + t * 150;
  const y = 556 - t * 104;
  return { x: x + noise(i, 8) * 10 - 5, y, r: 3 + (1 - t) * 4 };
});

/** Stones around the fire pit; the back half is drawn behind the flames. */
const FIRE_STONES = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: 680 + Math.cos(a) * 42, y: 480 + Math.sin(a) * 12, back: Math.sin(a) < 0 };
});

/** Flame tongues, 1 unit = 1 px, base on y = 0: the main one and two smaller at the sides. */
const FLAME = "M-22 0 C-27 -18 -12 -32 -8 -56 C0 -40 4 -46 3 -70 C17 -50 27 -26 22 0Z";
const FLAME_LEFT = "M-26 0 C-33 -14 -24 -28 -21 -44 C-13 -28 -5 -20 -5 0Z";
const FLAME_RIGHT = "M3 0 C6 -16 14 -24 17 -48 C27 -30 30 -12 24 0Z";

const SPARKS = [
  { x: 672, delay: 0 },
  { x: 686, delay: 0.5 },
  { x: 678, delay: 1.1 },
  { x: 690, delay: 1.6 },
];

/** Smoke puffs stacked into a column (still a column with reduced motion). */
const PUFFS = [
  { x: 682, y: 452, r: 12, delay: 0 },
  { x: 688, y: 420, r: 15, delay: 1.25 },
  { x: 696, y: 386, r: 18, delay: 2.5 },
  { x: 706, y: 350, r: 21, delay: 3.75 },
];

/**
 * The village behind the game, painted with the clock's colours (CSS variables written by
 * `useGameClock`): sky gradient, stars, sun and moon on their arcs, a forested ridge, the
 * near forest, the meadow with paths and grass, the half-timbered house whose windows light
 * up at night, and the campfire that burns from dusk to dawn and smokes once put out in the
 * morning. Purely decorative.
 */
export function Landscape() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{ background: "linear-gradient(to bottom, var(--sky-top), var(--sky-bottom) 72%)" }}
      />
      {/* Warm haze around the sun at dawn and dusk. */}
      <div
        className="absolute size-[60vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          left: "var(--sun-x)",
          top: "var(--sun-y)",
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
        className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fde68a] shadow-[0_0_80px_30px_rgb(253_230_138/0.45)] sm:size-24"
        style={{ left: "var(--sun-x)", top: "var(--sun-y)", opacity: "var(--sun-up)" }}
      />
      <div
        className="absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moon shadow-[0_0_50px_10px_rgb(244_233_200/0.25)] sm:size-20"
        style={{ left: "var(--moon-x)", top: "var(--moon-y)", opacity: "var(--moon-up)" }}
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
          <filter id="soft-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="fire-light">
            <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#ff7a1a" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Far ridge with its forest, then the near forest. */}
        <path d={FAR_PINES} style={fill("pines")} />
        <path d={RIDGE} style={fill("ridge")} />
        <path d={NEAR_FOREST} style={fill("forest")} />

        {/* Meadow behind the village, then the ground it stands on. */}
        <path
          d="M0 336 C 300 312 620 324 800 326 S 1300 310 1600 332 V560 H0Z"
          style={fill("meadow")}
        />
        <path
          d="M0 396 C 300 380 700 384 1000 390 S 1400 382 1600 394 V560 H0Z"
          style={fill("grass")}
        />

        <g strokeLinecap="round" strokeWidth="2.2" fill="none">
          <path d={DARK_TUFTS} style={{ stroke: "var(--sc-tuft)" }} />
          <path d={LIGHT_TUFTS} style={{ stroke: "var(--sc-blade)" }} />
        </g>

        {/* Paths: into the forest, the trodden ground round the fire, up to the door, out of the village. */}
        <g style={fill("path")}>
          <path d="M604 470 C 520 440 430 406 336 376 L 352 373 C 444 398 544 430 622 458Z" />
          <ellipse cx="682" cy="482" rx="128" ry="30" />
          <path d="M640 560 C 700 520 820 490 900 472 C 950 461 985 455 993 449 L1027 449 C 1020 462 990 476 950 490 C 900 508 870 530 860 560Z" />
          <path d="M1026 446 C 1150 440 1350 420 1600 398 L1600 410 C 1350 434 1160 456 1034 460Z" />
        </g>
        <g style={fill("stone")}>
          {PEBBLES.map((pebble) => (
            <ellipse
              key={`${pebble.x}-${pebble.y}`}
              cx={pebble.x}
              cy={pebble.y}
              rx={pebble.r}
              ry={pebble.r * 0.6}
            />
          ))}
        </g>

        <House />

        {/* A broad oak beside the house. */}
        <g transform="translate(1290 456)">
          <ellipse cx="0" cy="2" rx="60" ry="8" fill="rgb(0 0 0 / 0.25)" />
          <path
            d="M-9 0 C-6 -30 -8 -55 -14 -80 L-4 -82 C0 -60 4 -60 8 -82 L16 -78 C8 -55 8 -30 10 0Z"
            style={fill("bark")}
          />
          <g style={fill("forest")}>
            <circle cx="-40" cy="-100" r="38" />
            <circle cx="30" cy="-108" r="42" />
            <circle cx="-5" cy="-140" r="44" />
            <circle cx="45" cy="-150" r="30" />
            <circle cx="-48" cy="-142" r="28" />
          </g>
          <g style={{ ...fill("pines"), opacity: 0.55 }}>
            <circle cx="-20" cy="-152" r="22" />
            <circle cx="-52" cy="-112" r="18" />
            <circle cx="22" cy="-125" r="20" />
          </g>
        </g>

        <Campfire />

        {/* Big pines in front, at both edges. */}
        {[
          { x: 40, base: 430, h: 300 },
          { x: 150, base: 420, h: 210 },
          { x: 290, base: 412, h: 250 },
          { x: 1440, base: 418, h: 250 },
          { x: 1560, base: 432, h: 310 },
        ].map((pine) => (
          <g key={pine.x}>
            <ellipse
              cx={pine.x}
              cy={pine.base}
              rx={pine.h * 0.22}
              ry="7"
              fill="rgb(0 0 0 / 0.25)"
            />
            <rect x={pine.x - 7} y={pine.base - 30} width="14" height="30" style={fill("bark")} />
            <path d={pinePath(pine.x, pine.base - 18, pine.h)} style={fill("forest")} />
            <path d={pinePath(pine.x, pine.base - 18, pine.h, true)} fill="rgb(0 0 0 / 0.2)" />
          </g>
        ))}
      </svg>

      {/* Low fog drifting over the hills (still with reduced motion). */}
      <div className="absolute inset-x-[-10%] bottom-[8%] h-32 bg-gradient-to-t from-white/5 to-transparent blur-xl motion-safe:animate-fog" />
    </div>
  );
}

/**
 * Half-timbered house with a thatched roof and a woodpile: pale lime-washed walls against
 * the grass, dark oak frame, windows that glow at night.
 */
function House() {
  const windows = [30, 180];
  return (
    <g transform="translate(880 190)">
      <ellipse cx="130" cy="257" rx="175" ry="13" fill="rgb(0 0 0 / 0.3)" />

      {/* Chimney behind the roof. */}
      <rect x="190" y="12" width="28" height="80" style={fill("stone")} />
      <rect x="186" y="6" width="36" height="9" style={fill("stone")} />
      <rect x="186" y="6" width="36" height="9" fill="rgb(0 0 0 / 0.2)" />

      {/* Walls, footing and oak frame. */}
      <rect x="0" y="105" width="260" height="140" style={fill("wall")} />
      <rect x="-4" y="236" width="268" height="20" style={fill("stone")} />
      <path
        d="M-4 246 H264 M40 236 V246 M110 246 V256 M180 236 V246 M230 246 V256"
        stroke="rgb(0 0 0 / 0.22)"
        strokeWidth="2"
      />
      <g style={fill("timber")}>
        <rect x="0" y="105" width="260" height="9" />
        <rect x="0" y="186" width="260" height="7" />
        <rect x="0" y="105" width="9" height="131" />
        <rect x="96" y="105" width="9" height="131" />
        <rect x="160" y="105" width="9" height="131" />
        <rect x="251" y="105" width="9" height="131" />
      </g>
      <path
        d="M9 236 L44 193 M251 236 L216 193 M105 186 L132 114 M160 186 L133 114"
        strokeWidth="6"
        style={{ stroke: "var(--sc-timber)" }}
      />

      {/* Windows: dark panes and shutters by day, warm light at night. */}
      {windows.map((x) => (
        <g key={x}>
          <rect x={x - 12} y="133" width="12" height="44" style={fill("timber")} />
          <rect x={x + 46} y="133" width="12" height="44" style={fill("timber")} />
          <rect x={x - 3} y="132" width="52" height="46" style={fill("timber")} />
          <rect x={x} y="135" width="46" height="40" fill="#1c1820" />
        </g>
      ))}
      <g style={{ opacity: "var(--windows)" }}>
        {windows.map((x) => (
          <g key={x}>
            <rect x={x} y="135" width="46" height="40" fill="#ffc46b" filter="url(#window-glow)" />
            <rect x={x} y="135" width="46" height="40" fill="#ffd28a" />
          </g>
        ))}
      </g>
      <path
        d="M53 135 V175 M30 155 H76 M203 135 V175 M180 155 H226"
        strokeWidth="3"
        style={{ stroke: "var(--sc-timber)" }}
      />

      {/* Plank door and its step. */}
      <path d="M110 236 V176 Q130 160 150 176 V236Z" style={fill("timber")} />
      <path
        d="M120 236 V170 M130 236 V166 M140 236 V170"
        stroke="rgb(0 0 0 / 0.3)"
        strokeWidth="1.5"
      />
      <circle cx="143" cy="206" r="2.5" fill="#c9a24a" />
      <rect x="102" y="236" width="56" height="9" style={fill("stone")} />

      {/* Thatched roof with a thick eave. */}
      <path d="M-36 114 L130 -6 L296 114Z" style={fill("roof")} />
      <path
        d="M130 -6 L40 114 M130 -6 L90 114 M130 -6 L170 114 M130 -6 L220 114 M130 -6 L-4 102 M130 -6 L264 102"
        stroke="rgb(0 0 0 / 0.14)"
        strokeWidth="3"
      />
      <path d="M-36 114 H296 L288 126 H-28Z" style={fill("roof")} />
      <path d="M-36 114 H296 L288 126 H-28Z" fill="rgb(0 0 0 / 0.28)" />
      <path
        d="M100 16 L130 -6 L160 16"
        fill="none"
        strokeWidth="7"
        style={{ stroke: "var(--sc-timber)" }}
      />

      {/* Woodpile against the left wall. */}
      <g transform="translate(-62 216)">
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2, 3].slice(row).map((col) => {
            const cx = 8 + col * 14 - row * 7;
            return (
              <g key={`${row}-${col}`}>
                <circle cx={cx} cy={32 - row * 13} r="7" style={fill("bark")} />
                <circle cx={cx} cy={32 - row * 13} r="4" style={fill("path")} />
              </g>
            );
          }),
        )}
      </g>
    </g>
  );
}

/**
 * Fire pit in the clearing: stones, crossed logs and log seats. From dusk to dawn it burns
 * (flames, sparks, light on the ground); in the morning it is out and the embers smoke.
 */
function Campfire() {
  return (
    <g>
      {/* Light on the ground and the halo around the flames. */}
      <g style={{ opacity: "var(--fire)" }}>
        <ellipse cx="680" cy="482" rx="240" ry="70" fill="url(#fire-light)" />
        <circle cx="680" cy="440" r="110" fill="url(#fire-light)" />
      </g>

      {/* Log seats round the fire. */}
      <g transform="rotate(-6 580 492)">
        <rect x="545" y="484" width="74" height="17" rx="8.5" style={fill("bark")} />
        <ellipse cx="553" cy="492.5" rx="6" ry="8.5" style={fill("path")} />
      </g>
      <g transform="rotate(8 786 498)">
        <rect x="748" y="490" width="78" height="17" rx="8.5" style={fill("bark")} />
        <ellipse cx="818" cy="498.5" rx="6" ry="8.5" style={fill("path")} />
      </g>
      <ellipse cx="702" cy="530" rx="17" ry="7" style={fill("bark")} />
      <rect x="685" y="518" width="34" height="12" style={fill("bark")} />
      <ellipse cx="702" cy="518" rx="17" ry="6" style={fill("path")} />

      {/* Ash bed and the stones behind it. */}
      <ellipse cx="680" cy="480" rx="34" ry="9" fill="#2f2a2a" />
      {FIRE_STONES.filter((stone) => stone.back).map((stone) => (
        <ellipse key={stone.x} cx={stone.x} cy={stone.y} rx="8" ry="5.5" style={fill("stone")} />
      ))}

      {/* Crossed logs, charred at the middle. */}
      <g transform="rotate(-22 680 476)">
        <rect x="650" y="472" width="60" height="9" rx="4" style={fill("timber")} />
      </g>
      <g transform="rotate(22 680 476)">
        <rect x="650" y="472" width="60" height="9" rx="4" style={fill("timber")} />
      </g>
      <ellipse cx="680" cy="476" rx="14" ry="5" fill="#1b1414" />

      {/* Glowing embers: bright at night, a faint red glow while smoking in the morning. */}
      <ellipse
        cx="680"
        cy="477"
        rx="20"
        ry="5"
        fill="#ff5a1a"
        filter="url(#soft-blur)"
        style={{ opacity: "calc(var(--fire) + var(--smoke) * 0.35)" }}
      />

      {/* Flames. */}
      <g style={{ opacity: "var(--fire)" }}>
        <g transform="translate(680 478)">
          <path d={FLAME} fill="#ff7a1a" filter="url(#soft-blur)" transform="scale(1.25 1.15)" />
          <path
            d={FLAME_LEFT}
            fill="#d9480f"
            className="motion-safe:animate-flicker"
            style={{ animationDelay: "-0.45s" }}
          />
          <path
            d={FLAME_RIGHT}
            fill="#d9480f"
            className="motion-safe:animate-flicker"
            style={{ animationDelay: "-0.15s" }}
          />
          <path d={FLAME} fill="#e8590c" className="motion-safe:animate-flicker" />
          <path
            d={FLAME}
            fill="#ff9f1c"
            transform="scale(0.72 0.78)"
            className="motion-safe:animate-flicker"
            style={{ animationDelay: "-0.3s" }}
          />
          <path
            d={FLAME}
            fill="#ffe08a"
            transform="scale(0.4 0.48)"
            className="motion-safe:animate-flicker"
            style={{ animationDelay: "-0.6s" }}
          />
        </g>
        {SPARKS.map((spark) => (
          <circle
            key={spark.x}
            cx={spark.x}
            cy="440"
            r="1.8"
            fill="#ffc46b"
            className="motion-safe:animate-ember"
            style={{ animationDelay: `${spark.delay}s` }}
          />
        ))}
      </g>

      {/* Stones in front of the flames. */}
      {FIRE_STONES.filter((stone) => !stone.back).map((stone) => (
        <ellipse key={stone.x} cx={stone.x} cy={stone.y} rx="8" ry="5.5" style={fill("stone")} />
      ))}

      {/* Morning smoke rising from the doused fire. */}
      <g style={{ opacity: "var(--smoke)" }} filter="url(#soft-blur)">
        {PUFFS.map((puff) => (
          <circle
            key={puff.y}
            cx={puff.x}
            cy={puff.y}
            r={puff.r}
            fill="#d6d1c8"
            opacity="0.55"
            className="motion-safe:animate-rise"
            style={{ animationDelay: `${puff.delay}s` }}
          />
        ))}
      </g>
    </g>
  );
}
