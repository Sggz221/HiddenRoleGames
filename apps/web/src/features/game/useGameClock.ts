import type { GameViewMessage } from "@howlsinthedark/shared";
import { gsap } from "gsap";
import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef } from "react";
import { phaseKey } from "../../net/session";
import { dialAngle, gameHour, paletteAt, SCENERY_PARTS } from "./daytime";

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

/** Writes the colours and positions of `hour` as CSS variables: no React render per tick. */
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
  style.setProperty("--sun-x", `${sun.x}%`);
  style.setProperty("--sun-y", `${sun.y}%`);
  style.setProperty("--sun-up", sun.up.toFixed(3));
  style.setProperty("--moon-x", `${moon.x}%`);
  style.setProperty("--moon-y", `${moon.y}%`);
  style.setProperty("--moon-up", moon.up.toFixed(3));
}

/**
 * Runs the game clock while the game screen is mounted: the hour follows the phase timer
 * and glides (GSAP) when a new phase jumps it forward, e.g. from 05:00 to the 06:00 dawn.
 */
export function useGameClock(game: GameViewMessage, clockOffset: number): void {
  const reduce = useReducedMotionConfig() ?? false;
  const phase = useRef<{ key: string; start: number; duration: number } | null>(null);
  const held = useRef(19);
  const shown = useRef<{ h: number } | null>(null);

  // A new phase starts its stretch of the day; later views of the same phase keep it.
  const key = phaseKey(game);
  if (phase.current?.key !== key) {
    const duration = game.phaseEndsAt === null ? 0 : game.phaseEndsAt - game.serverNow;
    phase.current = { key, start: game.serverNow, duration: Math.max(1, duration) };
  }

  useEffect(() => {
    const target = () => {
      const current = phase.current;
      if (!current) return held.current;
      const progress = (Date.now() + clockOffset - current.start) / current.duration;
      const hour = gameHour(game.view.phase, progress, held.current);
      if (game.view.phase.kind !== "reaction") held.current = hour;
      return hour;
    };

    if (!shown.current) {
      // First paint (or a resumed game): start at the right hour, no sunrise replay.
      shown.current = { h: target() };
      paint(shown.current.h);
    }
    const proxy = shown.current;
    let tween: gsap.core.Tween | null = null;

    const step = () => {
      // Always move forward in time: 21:00 → 05:00 goes through midnight, not back.
      let next = target();
      while (next < proxy.h - 12) next += 24;
      while (next > proxy.h + 12) next -= 24;
      // While gliding, let it land; the next step picks up the few minutes it missed.
      if (tween?.isActive()) return;
      if (Math.abs(next - proxy.h) > 0.2 && !reduce) {
        // A new phase jumped the clock (05:00 → the 06:00 dawn): glide there.
        tween = gsap.to(proxy, {
          h: next,
          duration: 2.4,
          ease: "power2.inOut",
          onUpdate: () => paint(proxy.h),
        });
      } else {
        // Within a phase the hour creeps forward with the timer: follow it directly.
        proxy.h = next;
        paint(next);
      }
    };
    step();
    const id = setInterval(step, 500);
    return () => {
      clearInterval(id);
      tween?.kill();
    };
  }, [game.view.phase, clockOffset, reduce]);

  // Back to the default night colours when leaving the game.
  useEffect(
    () => () => {
      for (const name of COLOUR_VARS) document.documentElement.style.removeProperty(name);
    },
    [],
  );
}
