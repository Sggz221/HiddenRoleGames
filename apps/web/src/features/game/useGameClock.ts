import type { GameViewMessage } from "@howlsinthedark/shared";
import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef } from "react";
import { phaseKey } from "../../net/session";
import { dialAngle, gameHour, glide, nearestHour, paletteAt, SCENERY_PARTS } from "./daytime";

/** Where the sun and the moon sit on their arc (percent of the screen) at `hour`. */
function bodyPosition(
  hour: number,
  rise: number,
  length: number,
): { x: number; y: number; up: number } {
  const t = ((((hour - rise) % 24) + 24) % 24) / length;
  if (t < 0 || t > 1) return { x: t < 0.5 ? 6 : 94, y: 70, up: 0 };
  return {
    x: 8 + 84 * t,
    y: 62 - Math.sin(Math.PI * t) * 48,
    up: Math.min(1, Math.sin(Math.PI * t) * 4),
  };
}

/** Colour variables of the world; dropped when leaving the game (positions just go stale). */
const COLOUR_VARS = [
  "--sky-top",
  "--sky-bottom",
  "--land",
  "--glow",
  "--stars",
  "--windows",
  "--fire",
  "--smoke",
  ...SCENERY_PARTS.map((part) => `--sc-${part}`),
];

/**
 * Writes the colours and positions of `hour` as CSS variables: no React render per frame.
 * Positions are viewport units for `transform` (composited, sub-pixel smooth), not `left`/`top`.
 */
function paint(hour: number): void {
  const style = document.documentElement.style;
  const palette = paletteAt(hour);
  style.setProperty("--sky-top", palette.skyTop);
  style.setProperty("--sky-bottom", palette.skyBottom);
  style.setProperty("--land", palette.land);
  style.setProperty("--glow", palette.glow);
  style.setProperty("--stars", palette.stars.toFixed(3));
  style.setProperty("--windows", palette.windows.toFixed(3));
  style.setProperty("--fire", palette.fire.toFixed(3));
  style.setProperty("--smoke", palette.smoke.toFixed(3));
  for (const part of SCENERY_PARTS) style.setProperty(`--sc-${part}`, palette.scenery[part]);
  style.setProperty("--dial-angle", `${dialAngle(hour).toFixed(2)}deg`);
  const sun = bodyPosition(hour, 5.5, 14.5);
  const moon = bodyPosition(hour, 19.5, 11);
  style.setProperty("--sun-x", `${sun.x.toFixed(3)}vw`);
  style.setProperty("--sun-y", `${sun.y.toFixed(3)}vh`);
  style.setProperty("--sun-up", sun.up.toFixed(3));
  style.setProperty("--moon-x", `${moon.x.toFixed(3)}vw`);
  style.setProperty("--moon-y", `${moon.y.toFixed(3)}vh`);
  style.setProperty("--moon-up", moon.up.toFixed(3));
}

/** Below this change (in hours, ~1 s of game time) a frame is not repainted. */
const PAINT_EPSILON = 1 / 3600;

/**
 * Runs the game clock while the game screen is mounted: the hour follows the phase timer,
 * frame by frame, and eases (instead of jumping) when a new phase moves it forward, e.g.
 * from 05:00 to the 06:00 dawn. One animation loop for the whole screen: new views of the
 * same phase only update what it reads.
 */
export function useGameClock(game: GameViewMessage, clockOffset: number): void {
  const reduce = useReducedMotionConfig() ?? false;
  const phase = useRef<{ key: string; start: number; duration: number } | null>(null);
  const latest = useRef({ phase: game.view.phase, clockOffset });
  const held = useRef(19);

  // A new phase starts its stretch of the day; later views of the same phase keep it.
  const key = phaseKey(game);
  if (phase.current?.key !== key) {
    const duration = game.phaseEndsAt === null ? 0 : game.phaseEndsAt - game.serverNow;
    phase.current = { key, start: game.serverNow, duration: Math.max(1, duration) };
  }
  latest.current = { phase: game.view.phase, clockOffset };

  useEffect(() => {
    const target = () => {
      const current = phase.current;
      const { phase: now, clockOffset: offset } = latest.current;
      if (!current) return held.current;
      const progress = (Date.now() + offset - current.start) / current.duration;
      const hour = gameHour(now, progress, held.current);
      if (now.kind !== "reaction") held.current = hour;
      return hour;
    };

    // First paint (or a resumed game): start at the right hour, no sunrise replay.
    let shown = target();
    let painted = shown;
    paint(shown);
    let last = performance.now();
    let frame = 0;

    const tick = (time: number) => {
      const dt = Math.min(0.25, (time - last) / 1000);
      last = time;
      // Always move forward in time: 21:00 → 05:00 goes through midnight, not back.
      const next = nearestHour(target(), shown);
      shown = reduce ? next : glide(shown, next, dt);
      if (Math.abs(shown - painted) >= PAINT_EPSILON) {
        painted = shown;
        paint(shown);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);

  // Back to the default night colours when leaving the game.
  useEffect(
    () => () => {
      for (const name of COLOUR_VARS) document.documentElement.style.removeProperty(name);
    },
    [],
  );
}
