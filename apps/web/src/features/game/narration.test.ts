import {
  NARRATION_KEYS,
  type NarrationLine,
  type NarrationParams,
  ROLE_IDS,
} from "@aullidos/shared";
import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import es from "../../i18n/locales/es.json";
import { narrationText } from "./narration";

const t = i18n.t.bind(i18n);
const ana = { id: "p1", name: "Ana" };
const bea = { id: "p2", name: "Bea" };

/** Looks a dotted key up in the raw JSON, so a missing text is not hidden by a fallback. */
const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], es);

describe("narration texts", () => {
  it.each(NARRATION_KEYS)("%s has a Spanish text", (key) => {
    expect(typeof lookup(`narration.${key}`)).toBe("string");
  });

  it("every role has a name", () => {
    for (const role of ROLE_IDS) expect(typeof lookup(`roles.${role}`)).toBe("string");
  });

  it("never leaves a placeholder unfilled", () => {
    const params: NarrationParams = {
      player: ana,
      players: [ana, bea],
      role: "seer",
      side: "wolves",
      count: 2,
      day: 3,
    };
    for (const key of NARRATION_KEYS) {
      expect(narrationText(t, { key, params })).not.toMatch(/{{|}}/);
    }
  });
});

describe("narrationText", () => {
  it("fills names, translated roles and the number of victims", () => {
    expect(
      narrationText(t, { key: "death.night.role", params: { player: ana, role: "seer" } }),
    ).toBe("Ana aparece sin vida. Era Vidente.");
    expect(narrationText(t, { key: "dawn.many", params: { count: 3 } })).toBe(
      "Amanece. Esta noche han muerto 3 vecinos.",
    );
  });

  it("joins lists of players the Spanish way", () => {
    const line: NarrationLine = {
      key: "vote.runoff",
      params: { players: [ana, bea, { id: "p3", name: "Carla" }] },
    };
    expect(narrationText(t, line)).toBe(
      "Empate entre Ana, Bea y Carla. Habrá una segunda votación.",
    );
  });
});
