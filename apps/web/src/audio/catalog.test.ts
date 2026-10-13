import type { GameEvent, Phase } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { effectForEvent, musicForPhase } from "./catalog";

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
    expect(effectForEvent(changed(day), night)).toBe("dawn");
    expect(effectForEvent(changed({ kind: "day", step: "vote" }), day)).toBeNull();
  });

  it("reacts to deaths and votes, ignores private events", () => {
    expect(
      effectForEvent({ type: "playerDied", player: "p1", cause: "night", audience: all }, null),
    ).toBe("death");
    expect(
      effectForEvent({ type: "voteCast", voter: "p1", target: null, audience: all }, null),
    ).toBe("vote-cast");
    expect(effectForEvent({ type: "bearGrowled", audience: all }, null)).toBeNull();
  });
});
