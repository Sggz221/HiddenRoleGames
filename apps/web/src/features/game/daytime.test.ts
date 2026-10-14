import { describe, expect, it } from "vitest";
import {
  dialAngle,
  formatHour,
  gameHour,
  glide,
  isDaylight,
  nearestHour,
  paletteAt,
  SCENERY_PARTS,
} from "./daytime";

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

const luminance = (hex: string) => {
  const [r, g, b] = channels(hex);
  return (0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)) / 255;
};

/** WCAG contrast ratio between two colours (1 = identical, 21 = black on white). */
const contrast = (a: string, b: string) => {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const relative = (hex: string) => {
    const [r, g, b] = channels(hex).map(linear);
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };
  const [x, y] = [relative(a), relative(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("gameHour", () => {
  it("nights run from 21:00 to 05:00 across the steps", () => {
    expect(gameHour({ kind: "night", step: "cupid" }, 0)).toBe(21);
    expect(gameHour({ kind: "night", step: "piper" }, 1)).toBeCloseTo(5);
    const wolves = gameHour({ kind: "night", step: "wolves" }, 0.5);
    expect(wolves).toBeGreaterThanOrEqual(0);
    expect(wolves).toBeLessThan(5);
  });

  it("days follow election, debate, vote and runoff", () => {
    expect(gameHour({ kind: "day", step: "sheriff-election" }, 0)).toBe(6);
    expect(gameHour({ kind: "day", step: "debate" }, 0.5)).toBe(11.5);
    expect(gameHour({ kind: "day", step: "vote" }, 1)).toBe(18);
    expect(gameHour({ kind: "day", step: "runoff" }, 2)).toBe(19.5); // clamped
  });

  it("reactions keep the hour they interrupt", () => {
    expect(
      gameHour({ kind: "reaction", decision: { kind: "hunter-shot", actor: "p1" } }, 0.5, 6.25),
    ).toBe(6.25);
  });
});

describe("dial and clock", () => {
  it("puts 06:00 at the top, noon right, 18:00 bottom, midnight left", () => {
    expect(dialAngle(6)).toBe(0);
    expect(dialAngle(12)).toBe(90);
    expect(dialAngle(18)).toBe(180);
    expect(dialAngle(0)).toBe(270);
  });

  it("formats the hour and tells day from night", () => {
    expect(formatHour(21.5)).toBe("21:30");
    expect(formatHour(24.25)).toBe("00:15");
    expect(isDaylight(12)).toBe(true);
    expect(isDaylight(22)).toBe(false);
  });
});

describe("paletteAt", () => {
  it("is starry at midnight and starless at noon", () => {
    expect(paletteAt(0).stars).toBe(1);
    expect(paletteAt(12).stars).toBe(0);
    expect(paletteAt(12).windows).toBe(0);
  });

  it("interpolates between keyframes and wraps around midnight", () => {
    expect(paletteAt(24)).toEqual(paletteAt(0));
    const dawn = paletteAt(6.75);
    expect(dawn.skyTop).toMatch(/^#[0-9a-f]{6}$/);
    expect(dawn.stars).toBeGreaterThan(0);
    expect(dawn.stars).toBeLessThan(0.25);
  });

  it("keeps the top of the sky dark enough for light text", () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      expect(luminance(paletteAt(hour).skyTop), `hour ${hour}`).toBeLessThan(0.4);
    }
  });
});

describe("scenery", () => {
  it("is lit by day and only moonlit at night", () => {
    expect(paletteAt(12).light).toBe(1);
    expect(paletteAt(0).light).toBe(0);
    expect(luminance(paletteAt(12).scenery.grass)).toBeGreaterThan(
      luminance(paletteAt(0).scenery.grass) * 3,
    );
  });

  it("paints every part with a colour at every hour", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const { scenery } = paletteAt(hour);
      expect(Object.keys(scenery).sort()).toEqual([...SCENERY_PARTS].sort());
      for (const part of SCENERY_PARTS) expect(scenery[part]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the house walls standing out from the grass and the roof, day and night", () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const { wall, grass, roof } = paletteAt(hour).scenery;
      expect(luminance(wall), `hour ${hour}`).toBeGreaterThan(luminance(grass));
      expect(contrast(wall, grass), `hour ${hour}`).toBeGreaterThan(1.6);
      expect(contrast(wall, roof), `hour ${hour}`).toBeGreaterThan(1.6);
    }
  });

  it("keeps the paths lighter than the meadow they cross", () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const { path, grass } = paletteAt(hour).scenery;
      expect(luminance(path), `hour ${hour}`).toBeGreaterThan(luminance(grass));
    }
  });
});

describe("campfire", () => {
  it("burns through the night", () => {
    for (const hour of [21, 23, 0, 2, 4.5]) expect(paletteAt(hour).fire, `hour ${hour}`).toBe(1);
  });

  it("is put out in the morning and smokes", () => {
    expect(paletteAt(7.5).fire).toBe(0);
    expect(paletteAt(7.5).smoke).toBe(1);
    expect(paletteAt(9).smoke).toBeGreaterThan(0);
  });

  it("stays out and clear of smoke through the afternoon until dusk", () => {
    for (let hour = 13; hour <= 16.5; hour += 0.5) {
      expect(paletteAt(hour).fire, `hour ${hour}`).toBe(0);
      expect(paletteAt(hour).smoke, `hour ${hour}`).toBe(0);
    }
    expect(paletteAt(19.5).fire).toBeGreaterThan(0.5);
  });

  it("never burns and smokes at full strength together", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const { fire, smoke } = paletteAt(hour);
      expect(fire + smoke, `hour ${hour}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("sky motion", () => {
  it("always moves forward through midnight", () => {
    expect(nearestHour(1, 23)).toBe(25);
    expect(nearestHour(23, 1)).toBe(-1);
    expect(nearestHour(10, 9)).toBe(10);
  });

  it("glides towards the target the same way at any frame rate", () => {
    let fast = 0;
    for (let i = 0; i < 60; i++) fast = glide(fast, 1, 1 / 60);
    const slow = glide(glide(0, 1, 0.5), 1, 0.5);
    expect(fast).toBeCloseTo(slow, 6);
    expect(fast).toBeGreaterThan(0.75);
    expect(fast).toBeLessThan(1);
    expect(glide(0.3, 1, 0)).toBe(0.3);
  });
});
