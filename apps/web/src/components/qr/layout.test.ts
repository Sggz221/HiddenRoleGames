import { describe, expect, it } from "vitest";
import { buildQrLayout, FINDER_SIZE } from "./layout";

const LINK = "https://howlsinthedark.example/?sala=ABCDEF";

describe("buildQrLayout", () => {
  it("puts the three eyes in the corners of a valid QR grid", () => {
    const { size, finders } = buildQrLayout(LINK);
    // Version n has 17 + 4n modules per side.
    expect((size - 17) % 4).toBe(0);
    expect(finders).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: size - FINDER_SIZE },
      { row: size - FINDER_SIZE, col: 0 },
    ]);
  });

  it("never draws a dot inside an eye or the logo hole", () => {
    const { dots, finders, logo } = buildQrLayout(LINK);
    expect(dots.length).toBeGreaterThan(0);
    for (const { row, col } of dots) {
      for (const finder of finders) {
        const inside =
          row >= finder.row &&
          row < finder.row + FINDER_SIZE &&
          col >= finder.col &&
          col < finder.col + FINDER_SIZE;
        expect(inside).toBe(false);
      }
      const inLogo =
        row >= logo.start &&
        row < logo.start + logo.span &&
        col >= logo.start &&
        col < logo.start + logo.span;
      expect(inLogo).toBe(false);
    }
  });

  it("centres an odd-sized logo hole and keeps it small enough to scan", () => {
    const { size, logo } = buildQrLayout(LINK, 0.9);
    expect(logo.span % 2).toBe(1);
    expect(logo.start * 2 + logo.span).toBe(size);
    expect(logo.span / size).toBeLessThanOrEqual(0.27);
  });

  it("can skip the logo entirely", () => {
    const withLogo = buildQrLayout(LINK);
    const plain = buildQrLayout(LINK, 0);
    expect(plain.logo.span).toBe(0);
    expect(plain.dots.length).toBeGreaterThan(withLogo.dots.length);
  });

  it("is deterministic and depends on the text", () => {
    expect(buildQrLayout(LINK)).toEqual(buildQrLayout(LINK));
    expect(buildQrLayout(LINK).dots).not.toEqual(buildQrLayout(`${LINK}X`).dots);
  });
});
