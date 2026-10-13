import { NIGHT_STEPS, type Phase } from "@howlsinthedark/shared";

/**
 * The game's clock. Every phase covers a stretch of a 24 h day and the hour advances with
 * the phase timer, so the sky, the landscape and the colours follow the game.
 *
 * Night: 21:00 → 05:00 across the night steps (fixed order, so a step's hour never depends
 * on the secret deck). Day: sheriff election 06–08, debate 08–15, vote 15–18, runoff 18–19:30.
 * Reactions keep the hour they interrupt (the caller passes it as `held`).
 */
const DAY_SPANS = {
  "sheriff-election": [6, 8],
  debate: [8, 15],
  vote: [15, 18],
  runoff: [18, 19.5],
} as const;

const NIGHT_START = 21;
const NIGHT_LENGTH = 8;

/** Hour of the game day (0-24) for a phase at `progress` (0-1) of its timer. */
export function gameHour(phase: Phase, progress: number, held = 19): number {
  const p = Math.min(1, Math.max(0, progress));
  switch (phase.kind) {
    case "night": {
      const index = NIGHT_STEPS.indexOf(phase.step);
      const hour = NIGHT_START + (NIGHT_LENGTH * (index + p)) / NIGHT_STEPS.length;
      return hour % 24;
    }
    case "day": {
      const [from, to] = DAY_SPANS[phase.step];
      return from + (to - from) * p;
    }
    case "reaction":
      return held;
    case "ended":
      return 7;
  }
}

/** Hands of the dial: 06:00 at the top, day on the right half, night on the left. */
export const dialAngle = (hour: number): number => (((hour - 6) / 24) * 360 + 360) % 360;

export const isDaylight = (hour: number): boolean => hour >= 6 && hour < 19.5;

export interface Palette {
  /** Sky gradient, top to horizon. */
  skyTop: string;
  skyBottom: string;
  /** Hills and silhouettes. */
  land: string;
  /** Warm glow near the sun (dawn and dusk). */
  glow: string;
  /** 0-1: stars and lit windows fade with the light. */
  stars: number;
  windows: number;
}

type Key = [
  hour: number,
  top: string,
  bottom: string,
  land: string,
  glow: string,
  stars: number,
  windows: number,
];

/** Keyframes of the day; colours in between are interpolated. Light text must stay readable. */
const KEYS: Key[] = [
  [0, "#04060e", "#0b1230", "#05070d", "#1b1640", 1, 1],
  [4.5, "#0a0b20", "#2a1d4a", "#07081a", "#3a2456", 0.85, 1],
  [6, "#24315c", "#c86a5a", "#141a30", "#f08a5d", 0.25, 0.6],
  [7.5, "#2f5b93", "#e8a87c", "#1d2a3e", "#f6b26b", 0, 0.1],
  [10, "#24589a", "#6fa8dc", "#1f3346", "#9fd0ff", 0, 0],
  [13, "#1f5596", "#7db5e8", "#203648", "#bfe2ff", 0, 0],
  [16.5, "#2a4f86", "#d9935f", "#1e2c3c", "#f4a259", 0, 0],
  [18.5, "#2b2452", "#c8536a", "#141526", "#e9645a", 0.2, 0.7],
  [20, "#120f2c", "#3d2350", "#090a17", "#5a2f6b", 0.7, 1],
  [24, "#04060e", "#0b1230", "#05070d", "#1b1640", 1, 1],
];

const toRgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v + ((y[i] ?? v) - v) * t));
};

/** The colours of the world at `hour`. */
export function paletteAt(hour: number): Palette {
  const h = ((hour % 24) + 24) % 24;
  const nextIndex = KEYS.findIndex(([at]) => at > h);
  const next = KEYS[nextIndex] ?? KEYS[KEYS.length - 1];
  const prev = KEYS[Math.max(0, nextIndex - 1)] ?? KEYS[0];
  if (!next || !prev) throw new Error("palette keyframes missing");
  const t = next[0] === prev[0] ? 0 : (h - prev[0]) / (next[0] - prev[0]);
  return {
    skyTop: mix(prev[1], next[1], t),
    skyBottom: mix(prev[2], next[2], t),
    land: mix(prev[3], next[3], t),
    glow: mix(prev[4], next[4], t),
    stars: prev[5] + (next[5] - prev[5]) * t,
    windows: prev[6] + (next[6] - prev[6]) * t,
  };
}

/** "HH:MM" of the game clock. */
export const formatHour = (hour: number): string => {
  const minutes = Math.floor((((hour % 24) + 24) % 24) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** `hour` moved by whole days so it lies within 12 h of `from`: 23:00 → 01:00 goes forward. */
export function nearestHour(hour: number, from: number): number {
  let next = hour;
  while (next < from - 12) next += 24;
  while (next > from + 12) next -= 24;
  return next;
}

/**
 * One frame of the sky's glide towards `target`: exponential smoothing with time constant
 * `tau` seconds. Frame-rate independent, so a jump between phases eases in smoothly and the
 * steady creep within a phase is followed with a negligible lag.
 */
export function glide(current: number, target: number, dtSeconds: number, tau = 0.6): number {
  if (dtSeconds <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-dtSeconds / tau));
}
