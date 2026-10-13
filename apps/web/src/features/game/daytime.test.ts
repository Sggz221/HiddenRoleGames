import { describe, expect, it } from "vitest";
import { dialAngle, formatHour, gameHour, isDaylight, paletteAt } from "./daytime";

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
      const [r, g, b] = [1, 3, 5].map((i) =>
        Number.parseInt(paletteAt(hour).skyTop.slice(i, i + 2), 16),
      );
      const luminance = (0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)) / 255;
      expect(luminance, `hour ${hour}`).toBeLessThan(0.4);
    }
  });
});
