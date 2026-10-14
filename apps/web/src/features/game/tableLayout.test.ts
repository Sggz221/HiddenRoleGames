import { MAX_PLAYERS, MIN_PLAYERS } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { AVATAR_MIN_PX, circleOverlap, labelBox, layoutTable, overlapArea } from "./tableLayout";

const sizes = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS);

describe("round table", () => {
  it("puts seat 0 at the top and goes clockwise", () => {
    const { seats } = layoutTable(8, 400, 400);
    const [top, next, right, , bottom, , left] = seats;
    expect(top).toMatchObject({ x: 200, label: "below" });
    expect(top?.y).toBeLessThan(60);
    // Clockwise on screen: the next seat is to the right, the one after is at the far right.
    expect(next?.x).toBeGreaterThan(200);
    expect(right).toMatchObject({ y: 200, label: "left" });
    expect(bottom).toMatchObject({ x: 200, label: "above" });
    expect(left).toMatchObject({ y: 200, label: "right" });
    expect(left?.x).toBeLessThan(right?.x ?? 0);
  });

  it("depends only on the seats and the box, so every player sees the same table", () => {
    expect(layoutTable(12, 320, 420)).toEqual(layoutTable(12, 320, 420));
  });

  // Small phone, phone and desktop boxes (the table keeps its aspect ratio per screen).
  for (const [name, width, height] of [
    ["small phone", 272, 363],
    ["phone", 330, 440],
    ["desktop", 800, 500],
  ] as const) {
    it(`avatars never overlap on a ${name}, from ${MIN_PLAYERS} to ${MAX_PLAYERS} players`, () => {
      for (const count of sizes) {
        const { avatar, seats } = layoutTable(count, width, height);
        expect(avatar).toBeGreaterThanOrEqual(AVATAR_MIN_PX);
        seats.forEach((a, i) => {
          for (const b of seats.slice(i + 1)) {
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(avatar + 4);
          }
        });
        for (const { x, y } of seats) {
          expect(x - avatar / 2).toBeGreaterThanOrEqual(0);
          expect(x + avatar / 2).toBeLessThanOrEqual(width);
          expect(y - avatar / 2).toBeGreaterThanOrEqual(0);
          expect(y + avatar / 2).toBeLessThanOrEqual(height);
        }
      }
    });
  }

  const NAMES = [
    "Host",
    "Ana",
    "Bruno Martínez",
    "Carla",
    "Dani",
    "Elena",
    "Fermín",
    "Gloria",
    "Héctor",
    "Irene",
    "Julio",
    "Karen",
    "Lucía",
    "Mario",
    "Nuria",
    "Óscar",
    "Paula",
    "Quique",
    "Rosa",
    "Sergio",
  ];
  for (const [name, width, height, charWidth] of [
    ["phone", 330, 440, 12 * 0.55],
    ["desktop", 800, 500, 14 * 0.55],
  ] as const) {
    it(`names never cover each other or an avatar on a ${name}`, () => {
      for (const count of sizes) {
        const labels = NAMES.slice(0, count).map((n) => ({
          width: n.length * charWidth,
          height: 16,
        }));
        const { avatar, seats } = layoutTable(count, width, height, labels);
        const boxes = seats.map((seat, i) =>
          labelBox(
            seat.x,
            seat.y,
            avatar,
            seat.label,
            Math.min(labels[i]?.width ?? 0, seat.labelWidth + 1),
            16,
          ),
        );
        const centre = {
          left: width / 2 - 36,
          top: height / 2 - 48,
          right: width / 2 + 36,
          bottom: height / 2 + 48,
        };
        boxes.forEach((box, i) => {
          expect(overlapArea(box, centre), `${count}: ${NAMES[i]} on the centre`).toBe(0);
          for (const [j, other] of boxes.entries()) {
            if (j > i) expect(overlapArea(box, other), `${count}: ${NAMES[i]}/${NAMES[j]}`).toBe(0);
          }
          for (const [j, seat] of seats.entries()) {
            if (j !== i) {
              // Sub-pixel touches are invisible; anything bigger is a real overlap.
              expect(
                circleOverlap(box, seat, avatar / 2),
                `${count}: ${NAMES[i]} on ${j}`,
              ).toBeLessThan(1);
            }
          }
        });
      }
    });
  }
});
