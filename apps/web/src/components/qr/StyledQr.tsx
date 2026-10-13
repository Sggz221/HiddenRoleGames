import { PawPrint } from "lucide-react";
import { useId, useMemo } from "react";
import { buildQrLayout, FINDER_SIZE } from "./layout";

/** Light margin around the code, in modules. Scanners want some; 4 is the spec, 3 suffices. */
const QUIET = 3;
/** Dot radius in modules: a bit under half so neighbours read as separate beads. */
const DOT_RADIUS = 0.42;

interface Props {
  /** What the code encodes (the join link). */
  value: string;
  /** Accessible description of the image. */
  label: string;
  className?: string;
}

/**
 * A QR drawn in the game's style: round beads instead of squares, circular eyes and a wolf
 * paw in the middle. Colours stay dark-on-parchment in both themes because phone cameras
 * read inverted codes badly.
 */
export function StyledQr({ value, label, className = "" }: Props) {
  const layout = useMemo(() => buildQrLayout(value), [value]);
  const gradientId = useId();
  const { size, dots, finders, logo } = layout;
  const side = size + QUIET * 2;
  const centre = side / 2;
  const logoRadius = logo.span / 2;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-sky)" />
          <stop offset="100%" stopColor="#3a0f1c" />
        </linearGradient>
      </defs>
      <rect width={side} height={side} rx={2.5} fill="var(--color-moon)" />

      <g fill={`url(#${gradientId})`}>
        {dots.map(({ row, col }) => (
          <circle
            key={`${row}-${col}`}
            cx={QUIET + col + 0.5}
            cy={QUIET + row + 0.5}
            r={DOT_RADIUS}
          />
        ))}
      </g>

      {finders.map(({ row, col }) => {
        const cx = QUIET + col + FINDER_SIZE / 2;
        const cy = QUIET + row + FINDER_SIZE / 2;
        return (
          <g key={`${row}-${col}`}>
            {/* Outer ring covers the 7×7 frame (radius 2.5 to 3.5), inner disc the 3×3 core. */}
            <circle
              cx={cx}
              cy={cy}
              r={3}
              fill="none"
              stroke="var(--color-blood-strong)"
              strokeWidth={1}
            />
            <circle cx={cx} cy={cy} r={1.5} fill="var(--color-sky)" />
          </g>
        );
      })}

      {logo.span > 0 && (
        <g>
          <circle
            cx={centre}
            cy={centre}
            r={logoRadius - 0.3}
            fill="var(--color-blood-strong)"
            stroke="var(--color-moon)"
            strokeWidth={0.4}
          />
          <PawPrint
            aria-hidden="true"
            x={centre - logoRadius * 0.55}
            y={centre - logoRadius * 0.55}
            width={logoRadius * 1.1}
            height={logoRadius * 1.1}
            color="var(--color-moon)"
            strokeWidth={2.2}
          />
        </g>
      )}
    </svg>
  );
}
