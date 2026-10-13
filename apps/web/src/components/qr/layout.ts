import qrcode from "qrcode-generator";

/** Side of a finder pattern ("eye"), in modules. */
export const FINDER_SIZE = 7;

export interface QrLayout {
  /** Modules per side, without quiet zone. */
  size: number;
  /** Dark data modules, drawn as dots. Finders and the logo hole are left out. */
  dots: readonly { row: number; col: number }[];
  /** Top-left module of each of the three finder patterns. */
  finders: readonly { row: number; col: number }[];
  /** Centre square left blank for the logo, in modules (0 when there is no logo). */
  logo: { start: number; span: number };
}

/**
 * Turns `text` into the pieces a stylised QR is drawn from. Uses the highest error
 * correction (H, ~30%) so the centre can be cleared for a logo and the dots can be round
 * without hurting readability. `logoRatio` is the share of the side the hole takes; above
 * ~0.25 scanners start to fail, so it is clamped.
 */
export function buildQrLayout(text: string, logoRatio = 0.22): QrLayout {
  const qr = qrcode(0, "H");
  qr.addData(text, "Byte");
  qr.make();
  const size = qr.getModuleCount();

  const ratio = Math.min(Math.max(logoRatio, 0), 0.25);
  // Odd span keeps the hole centred on the module grid (size is always odd).
  let span = Math.round(size * ratio);
  if (span > 0 && span % 2 === 0) span += 1;
  const start = (size - span) / 2;

  const finders = [
    { row: 0, col: 0 },
    { row: 0, col: size - FINDER_SIZE },
    { row: size - FINDER_SIZE, col: 0 },
  ];
  const inFinder = (row: number, col: number) =>
    finders.some(
      (finder) =>
        row >= finder.row &&
        row < finder.row + FINDER_SIZE &&
        col >= finder.col &&
        col < finder.col + FINDER_SIZE,
    );
  const inLogo = (row: number, col: number) =>
    span > 0 && row >= start && row < start + span && col >= start && col < start + span;

  const dots: { row: number; col: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col) && !inFinder(row, col) && !inLogo(row, col)) {
        dots.push({ row, col });
      }
    }
  }
  return { size, dots, finders, logo: { start, span } };
}
