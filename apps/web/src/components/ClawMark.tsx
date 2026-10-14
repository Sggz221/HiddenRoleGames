import { motion, useReducedMotionConfig } from "motion/react";

/** Three claw slashes, top right to bottom left, slightly curved like a swipe. */
const SLASHES = [
  "M33 6 C 27 17, 19 29, 9 40",
  "M40 11 C 34 22, 26 33, 16 44",
  "M45 18 C 40 28, 33 37, 24 46",
];

/**
 * The mark of a dead player: a red claw swipe. It is drawn stroke by stroke when it appears
 * (after `delay` seconds), or shown at once when `draw` is off or with reduced motion.
 */
export function ClawMark({
  className = "",
  delay = 0,
  draw = true,
}: {
  className?: string;
  delay?: number;
  draw?: boolean;
}) {
  const reduce = useReducedMotionConfig();
  const animated = draw && !reduce;
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={`text-blood drop-shadow-[0_0_4px_rgb(0_0_0/0.7)] ${className}`}
    >
      {SLASHES.map((path, index) => (
        <motion.path
          key={path}
          d={path}
          stroke="currentColor"
          strokeWidth={4.5}
          strokeLinecap="round"
          initial={animated ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.25,
            delay: animated ? delay + 0.15 + index * 0.12 : 0,
            ease: "easeIn",
          }}
        />
      ))}
    </svg>
  );
}
