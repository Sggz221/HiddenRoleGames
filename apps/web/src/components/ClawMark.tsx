import { motion, useReducedMotionConfig } from "motion/react";
import { useId } from "react";

/**
 * Four torn claw slashes, bottom left to top right: sharp tips, ragged edges, widest near the
 * top. Drawn on a 48x48 box (generated once with a seeded jitter, so every client agrees).
 */
const SLASHES = [
  "M4.0 33.0L4.6 32.4L5.2 31.8L5.8 31.2L6.4 30.6L7.0 30.1L7.6 29.5L8.2 28.9L9.0 28.4L9.6 27.9L10.2 27.3L10.6 26.6L11.5 26.2L11.9 25.4L12.6 24.9L13.2 24.3L14.0 23.9L14.4 23.1L15.1 22.7L15.8 22.1L16.4 21.5L16.3 20.5L17.0 20.0L17.5 19.3L18.1 18.7L18.4 17.9L18.5 17.0L19.1 16.4L19.5 15.7L19.4 14.5L20.1 14.0L20.0 13.0L20.7 12.5L20.7 11.4L21.1 10.7L21.4 10.0L21.7 9.2L22.0 8.3L22.3 7.5L22.6 6.8L23.0 6.0L22.6 6.7L22.1 7.4L21.6 8.0L21.1 8.7L20.7 9.4L20.1 10.0L19.6 10.7L18.9 11.2L18.6 12.0L17.9 12.5L17.4 13.2L16.8 13.8L16.5 14.5L15.9 15.1L15.2 15.7L14.8 16.4L14.5 17.2L13.9 17.8L13.6 18.6L12.7 18.9L12.2 19.6L12.0 20.5L11.6 21.2L11.0 21.8L10.7 22.6L10.3 23.3L10.1 24.2L9.6 24.8L9.4 25.7L8.6 26.2L8.2 26.9L7.9 27.7L7.4 28.3L7.0 29.0L6.5 29.7L6.0 30.4L5.5 31.1L5.0 31.7L4.5 32.4Z",
  "M8.0 42.0L8.7 41.2L9.4 40.5L10.1 39.8L10.8 39.1L11.6 38.4L12.3 37.6L12.9 36.9L13.9 36.3L14.4 35.5L15.3 34.8L15.9 34.0L16.9 33.5L17.7 32.8L18.4 32.1L18.7 31.1L20.1 30.8L20.2 29.6L21.4 29.3L21.4 28.1L22.8 27.8L22.8 26.6L23.4 25.8L23.7 24.8L24.6 24.1L25.0 23.2L25.5 22.3L25.5 21.1L26.5 20.6L26.7 19.5L27.4 18.7L27.2 17.4L28.0 16.7L28.1 15.6L28.7 14.8L28.9 13.7L29.5 12.8L29.8 11.8L30.1 10.9L30.5 9.9L31.0 9.0L30.4 9.8L29.9 10.7L29.3 11.5L28.6 12.2L27.9 13.0L27.4 13.8L26.8 14.7L26.1 15.4L25.6 16.2L24.8 16.9L24.3 17.8L23.2 18.3L23.1 19.4L21.9 19.9L21.8 21.0L20.6 21.4L20.3 22.4L19.3 22.9L19.6 24.3L18.3 24.7L17.8 25.5L17.2 26.3L17.3 27.7L16.3 28.1L16.3 29.4L15.3 29.9L15.2 31.1L14.5 31.8L14.1 32.8L13.5 33.6L13.3 34.6L12.5 35.4L12.1 36.3L11.4 37.0L11.0 37.9L10.4 38.8L9.8 39.6L9.2 40.4L8.6 41.2Z",
  "M15.0 46.0L15.7 45.3L16.4 44.6L17.1 43.9L17.9 43.2L18.6 42.4L19.5 41.9L20.2 41.2L21.1 40.5L21.7 39.7L22.7 39.3L23.2 38.4L24.3 38.0L24.8 37.1L25.7 36.5L26.0 35.5L27.4 35.3L27.8 34.4L28.8 33.8L29.0 32.8L29.8 32.1L30.0 31.0L31.1 30.6L31.6 29.7L32.3 29.0L32.3 27.7L33.1 27.1L33.2 25.9L34.3 25.4L34.3 24.2L34.9 23.4L35.1 22.3L35.8 21.6L36.1 20.6L36.5 19.6L36.8 18.6L37.3 17.7L37.7 16.8L38.1 15.8L38.5 14.9L39.0 14.0L38.4 14.8L37.8 15.6L37.1 16.4L36.5 17.1L35.9 17.9L35.2 18.6L34.6 19.5L33.7 20.0L33.3 21.0L32.4 21.5L31.7 22.3L31.0 23.0L30.8 24.1L29.6 24.5L29.6 25.7L28.2 25.9L28.0 27.0L27.3 27.7L26.7 28.5L25.8 29.1L25.4 30.0L24.8 30.9L24.7 32.0L23.7 32.5L23.4 33.6L22.8 34.3L22.5 35.4L21.8 36.1L21.3 37.0L20.7 37.8L20.3 38.7L19.6 39.5L19.2 40.4L18.6 41.2L18.1 42.1L17.4 42.8L16.9 43.7L16.3 44.5L15.6 45.2Z",
  "M25.0 45.0L25.6 44.5L26.2 44.0L26.7 43.5L27.4 43.1L27.9 42.6L28.6 42.2L29.2 41.7L29.8 41.2L30.3 40.7L31.1 40.4L31.7 39.9L32.3 39.4L32.9 38.9L33.6 38.6L34.2 38.1L34.8 37.6L35.2 36.9L35.7 36.4L36.4 36.0L36.9 35.5L37.4 34.9L37.9 34.4L38.1 33.5L38.9 33.3L39.2 32.5L39.4 31.7L39.8 31.1L40.2 30.4L40.5 29.8L41.0 29.2L41.1 28.3L41.5 27.7L41.7 26.9L42.0 26.2L42.4 25.5L42.7 24.8L43.0 24.0L43.3 23.4L43.6 22.7L44.0 22.0L43.6 22.6L43.1 23.2L42.6 23.7L42.1 24.3L41.6 24.8L41.0 25.3L40.6 25.9L39.9 26.4L39.7 27.1L39.0 27.5L38.4 28.0L37.9 28.5L37.3 29.1L36.9 29.7L36.4 30.2L36.0 30.9L35.4 31.3L34.7 31.8L34.5 32.6L33.9 33.0L33.8 33.9L33.0 34.2L33.0 35.1L32.3 35.5L31.7 36.1L31.3 36.7L31.1 37.5L30.7 38.1L30.3 38.8L29.8 39.3L29.4 40.0L28.8 40.4L28.4 41.1L28.0 41.7L27.6 42.3L27.0 42.8L26.5 43.4L26.0 43.9L25.5 44.5Z",
];

/**
 * The mark of a dead player: a claw tear with a saturated red rim and a dark, deep inside.
 * The rims are drawn stroke by stroke when it appears (after `delay` seconds) and the wound
 * darkens after them; it is shown at once when `draw` is off or with reduced motion.
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
  const wound = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={`drop-shadow-[0_0_2px_rgb(0_0_0/0.8)] ${className}`}
    >
      <defs>
        <linearGradient id={wound} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b0309" />
          <stop offset="0.5" stopColor="#4a0712" />
          <stop offset="1" stopColor="#1a0206" />
        </linearGradient>
      </defs>
      {SLASHES.map((path, index) => (
        <motion.path
          key={path}
          d={path}
          fill={`url(#${wound})`}
          stroke="#ff1f3d"
          strokeWidth={0.7}
          strokeLinejoin="miter"
          initial={animated ? { pathLength: 0, fillOpacity: 0 } : false}
          animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{
            pathLength: {
              duration: 0.25,
              delay: animated ? delay + 0.15 + index * 0.1 : 0,
              ease: "easeIn",
            },
            fillOpacity: { duration: 0.3, delay: animated ? delay + 0.4 + index * 0.1 : 0 },
          }}
        />
      ))}
    </svg>
  );
}
