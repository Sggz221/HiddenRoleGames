import type { GameEvent, Phase } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { DEFAULT_LEVEL, effectForEvent, musicForPhase, parseLevel } from "./catalog";

const night: Phase = { kind: "night", step: "wolves" };
const day: Phase = { kind: "day", step: "debate" };
const all = { kind: "all" } as const;

describe("musicForPhase", () => {
  it("maps every phase to a track or silence", () => {
    expect(musicForPhase(night)).toBe("night");
    expect(musicForPhase(day)).toBe("day");
    expect(musicForPhase({ kind: "day", step: "sheriff-election" })).toBe("day");
    expect(musicForPhase({ kind: "day", step: "vote" })).toBe("vote");
    expect(musicForPhase({ kind: "day", step: "runoff" })).toBe("vote");
    expect(
      musicForPhase({ kind: "reaction", decision: { kind: "hunter-shot", actor: "p1" } }),
    ).toBe("vote");
    expect(musicForPhase({ kind: "ended" })).toBeNull();
  });

  it("does not change track between steps of the same night (no restart)", () => {
    expect(musicForPhase({ kind: "night", step: "seer" })).toBe(musicForPhase(night));
  });
});

describe("effectForEvent", () => {
  const changed = (phase: Phase): GameEvent => ({
    type: "phaseChanged",
    phase,
    day: 1,
    audience: all,
  });

  it("howls when night falls, once, and rings at dawn", () => {
    expect(effectForEvent(changed(night), day)).toBe("howl");
    expect(effectForEvent(changed(night), null)).toBe("howl");
    expect(effectForEvent(changed({ kind: "night", step: "seer" }), night)).toBeNull();
    // The pack wakes with a growl.
    expect(
      effectForEvent(changed({ kind: "night", step: "wolves" }), { kind: "night", step: "seer" }),
    ).toBe("growl");
    expect(effectForEvent(changed(day), night)).toBe("dawn");
    expect(effectForEvent(changed({ kind: "day", step: "vote" }), day)).toBeNull();
  });

  it("reacts to deaths and votes, ignores private events", () => {
    expect(effectForEvent({ type: "playerDied", player: "p1", cause: "night" }, null)).toBe("bell");
    expect(effectForEvent({ type: "playerDied", player: "p1", cause: "vote" }, null)).toBe("death");
    expect(effectForEvent({ type: "voteCast", voter: "p1" }, null)).toBe("vote-cast");
    expect(effectForEvent({ type: "bearGrowled" }, null)).toBeNull();
  });
});

describe("parseLevel", () => {
  it("reads a stored volume, clamped to 0-1, or falls back to the default", () => {
    expect(parseLevel("0.35")).toBe(0.35);
    expect(parseLevel("0")).toBe(0);
    expect(parseLevel("3")).toBe(1);
    expect(parseLevel("-1")).toBe(0);
    expect(parseLevel(null)).toBe(DEFAULT_LEVEL);
    expect(parseLevel("")).toBe(DEFAULT_LEVEL);
    expect(parseLevel("loud")).toBe(DEFAULT_LEVEL);
  });
});
