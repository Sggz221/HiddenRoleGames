/**
 * Geometry of the round table. Every player sees the same table: seat 0 at the top and the
 * rest clockwise (the engine's "left" is the next seat, as when sitting around a real table),
 * never rotated towards the viewer. The ring is an ellipse that fills the box (taller than wide
 * on phones, wider on desktops); seats are spread evenly along it so none get crowded.
 */

/** Where a name goes, relative to its avatar: towards the centre of the table when it fits. */
export type LabelSide = "below" | "above" | "left" | "right";

export interface SeatSpot {
  /** Centre of the avatar, in px from the table's top-left corner. */
  x: number;
  y: number;
  label: LabelSide;
  /** Widest the name may be on that side (longer names are cut with an ellipsis). */
  labelWidth: number;
}

export interface TableLayout {
  /** Avatar diameter in px. */
  avatar: number;
  seats: SeatSpot[];
}

/** Estimated size of a seat's name block (text width and its lines), in px. */
export interface LabelSize {
  width: number;
  height: number;
}

/** Avatar size limits (px): big for small tables, never too small to tap. */
export const AVATAR_MIN_PX = 36;
export const AVATAR_MAX_PX = 64;
/** Room between an avatar and the edge of the table (badges stick out a little). */
const EDGE_PX = 6;
/** An avatar takes this share of the distance to its neighbours. */
const AVATAR_SHARE = 0.62;
const SAMPLES = 720;
/** Gap between an avatar and its name (matches the CSS margins). */
const LABEL_GAP = { vertical: 4, side: 6 };
const DEFAULT_LABEL: LabelSize = { width: 48, height: 16 };
/** A name is never cut below this (about three letters and the ellipsis). */
const MIN_LABEL_PX = 28;
/** Width shares to try, and whether sides facing away from the centre are allowed. */
const SEARCH: readonly [number, boolean][] = [
  [1, false],
  [0.75, false],
  [0.5, false],
  [0.3, false],
  [1, true],
  [0.5, true],
];

const DIRECTIONS: Record<LabelSide, { x: number; y: number }> = {
  below: { x: 0, y: 1 },
  above: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Lays out `count` seats in a `width` x `height` table. `labels` (one per seat, optional) are
 * the estimated sizes of the names: each name goes on the side of its avatar that points most
 * towards the centre without covering another name or avatar.
 */
export function layoutTable(
  count: number,
  width: number,
  height: number,
  labels: readonly LabelSize[] = [],
): TableLayout {
  // The avatar size sets the ring's radii and the ring sets the avatar size: two passes settle it.
  let avatar = AVATAR_MIN_PX;
  let ring = ellipse(width, height, avatar);
  for (let pass = 0; pass < 2; pass++) {
    avatar = clamp((ring.length / count) * AVATAR_SHARE, AVATAR_MIN_PX, AVATAR_MAX_PX);
    ring = ellipse(width, height, avatar);
  }
  const spacing = ring.length / count;
  const maxWidth: Record<LabelSide, number> = {
    below: Math.max(AVATAR_MIN_PX, spacing - 4),
    above: Math.max(AVATAR_MIN_PX, spacing - 4),
    left: Math.min(128, width * 0.28),
    right: Math.min(128, width * 0.28),
  };

  const centres = Array.from({ length: count }, (_, seat) => {
    const angle = ring.angleAt((ring.length * seat) / count);
    return {
      x: width / 2 + ring.rx * Math.cos(angle),
      y: height / 2 + ring.ry * Math.sin(angle),
    };
  });
  // Each name tries the sides that face the centre, first at full width, then cut shorter;
  // only if nothing fits does it take the least crowded spot. A second pass revisits every
  // name knowing where all the others ended up.
  const choices: { side: LabelSide; width: number; box: Box }[] = [];
  for (let pass = 0; pass < 2; pass++) {
    centres.forEach(({ x, y }, seat) => {
      const size = labels[seat] ?? DEFAULT_LABEL;
      const inward = { x: width / 2 - x, y: height / 2 - y };
      const length = Math.hypot(inward.x, inward.y) || 1;
      const sides = (Object.keys(DIRECTIONS) as LabelSide[])
        .map((side) => ({
          side,
          towards: (DIRECTIONS[side].x * inward.x + DIRECTIONS[side].y * inward.y) / length,
        }))
        .sort((a, b) => b.towards - a.towards);
      const names = choices.filter((_, index) => index !== seat).map((choice) => choice.box);
      const faces = centres.filter((_, index) => index !== seat);
      const crowding = (candidate: Box) =>
        names.reduce((sum, other) => sum + overlapArea(candidate, other), 0) +
        faces.reduce((sum, face) => sum + 20 * circleOverlap(candidate, face, avatar / 2), 0) +
        outside(candidate, width, height);

      let best: { side: LabelSide; width: number; box: Box; cost: number } | null = null;
      // Facing the centre first; facing out only as a last resort.
      search: for (const [share, outward] of SEARCH) {
        for (const { side, towards } of sides) {
          if (towards < -0.2 && !outward) continue;
          const labelWidth = Math.max(MIN_LABEL_PX, Math.min(size.width * share, maxWidth[side]));
          const candidate = labelBox(x, y, avatar, side, labelWidth, size.height);
          const cost = crowding(candidate);
          if (!best || cost < best.cost) best = { side, width: labelWidth, box: candidate, cost };
          if (cost === 0) break search;
        }
      }
      if (best) choices[seat] = best;
    });
  }

  const seats = centres.map(({ x, y }, seat): SeatSpot => {
    const choice = choices[seat];
    return {
      x: round(x),
      y: round(y),
      label: choice?.side ?? "below",
      labelWidth: Math.floor(choice?.width ?? maxWidth.below),
    };
  });

  return { avatar: round(avatar), seats };
}

/** Where a name block lands for a given side (mirrors the CSS placement in `PlayersTable`). */
export function labelBox(
  x: number,
  y: number,
  avatar: number,
  side: LabelSide,
  width: number,
  height: number,
): Box {
  const r = avatar / 2;
  switch (side) {
    case "below":
      return box(x - width / 2, y + r + LABEL_GAP.vertical, width, height);
    case "above":
      return box(x - width / 2, y - r - LABEL_GAP.vertical - height, width, height);
    case "left":
      return box(x - r - LABEL_GAP.side - width, y - height / 2, width, height);
    case "right":
      return box(x + r + LABEL_GAP.side, y - height / 2, width, height);
  }
}

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** How deep a box cuts into a round avatar (0 when they do not touch). */
export function circleOverlap(b: Box, centre: { x: number; y: number }, radius: number): number {
  const dx = Math.max(b.left - centre.x, 0, centre.x - b.right);
  const dy = Math.max(b.top - centre.y, 0, centre.y - b.bottom);
  return Math.max(0, radius - Math.hypot(dx, dy));
}

/** How much of a box sticks out of the table (penalised like an overlap). */
const outside = (b: Box, width: number, height: number): number =>
  20 *
  (Math.max(0, -b.left) +
    Math.max(0, b.right - width) +
    Math.max(0, -b.top) +
    Math.max(0, b.bottom - height));

/**
 * The ring for a given avatar size: radii that keep avatars inside the box, its length, and the
 * angle at a given distance along it (starting at the top, going clockwise on screen).
 */
function ellipse(width: number, height: number, avatar: number) {
  const rx = Math.max(0, width / 2 - avatar / 2 - EDGE_PX);
  const ry = Math.max(0, height / 2 - avatar / 2 - EDGE_PX);
  const angles: number[] = [];
  const lengths: number[] = [];
  let length = 0;
  let previous = { x: 0, y: -ry };
  for (let i = 0; i <= SAMPLES; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / SAMPLES;
    const point = { x: rx * Math.cos(angle), y: ry * Math.sin(angle) };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
    angles.push(angle);
    lengths.push(length);
  }
  const angleAt = (distance: number): number => {
    const index = lengths.findIndex((value) => value >= distance);
    if (index <= 0) return angles[Math.max(index, 0)] ?? -Math.PI / 2;
    const before = lengths[index - 1] ?? 0;
    const after = lengths[index] ?? before;
    const t = after === before ? 0 : (distance - before) / (after - before);
    return (angles[index - 1] ?? 0) + t * ((angles[index] ?? 0) - (angles[index - 1] ?? 0));
  };
  return { rx, ry, length, angleAt };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;
