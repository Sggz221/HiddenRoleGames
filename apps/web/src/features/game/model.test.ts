import { type GameActionType, gameActionSchema } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import {
  buildAction,
  formatClock,
  mainAction,
  remainingSeconds,
  tally,
  toggleTarget,
} from "./model";

describe("countdown", () => {
  it("uses the server clock, never goes negative and hides when there is no timer", () => {
    // Our clock is 2 s behind the server: 10 s left by the server's watch.
    expect(remainingSeconds(20_000, 8_000, 2_000)).toBe(10);
    expect(remainingSeconds(20_000, 8_001, 2_000)).toBe(10);
    expect(remainingSeconds(20_000, 30_000, 0)).toBe(0);
    expect(remainingSeconds(null, 0, 0)).toBeNull();
  });

  it("formats minutes and seconds", () => {
    expect(formatClock(185)).toBe("3:05");
    expect(formatClock(9)).toBe("0:09");
  });
});

describe("tally", () => {
  it("groups votes by target, most voted first, abstentions included", () => {
    expect(tally({ a: "c", b: "c", d: null, c: "a" })).toEqual([
      { target: "c", voters: ["a", "b"] },
      { target: null, voters: ["d"] },
      { target: "a", voters: ["c"] },
    ]);
  });
});

describe("actions", () => {
  const ALL_TYPES = gameActionSchema.options.map((option) => option.shape.type.value);

  it("knows how to answer every action type", () => {
    for (const type of ALL_TYPES.filter(
      (t): t is Exclude<GameActionType, "skip"> => t !== "skip",
    )) {
      expect(mainAction({ types: [type, "skip"], targets: [] })?.type).toBe(type);
    }
    expect(mainAction({ types: ["skip"], targets: [] })).toBeNull();
  });

  it("builds payloads the server accepts", () => {
    const built = [
      buildAction("seerInspect", { targets: ["p2"] }),
      buildAction("vote", { targets: [] }),
      buildAction("cupidLink", { targets: ["p1", "p2"] }),
      buildAction("piperCharm", { targets: ["p1"] }),
      buildAction("wolfHoundChoose", { targets: [], side: "wolves" }),
      buildAction("infect", { targets: [], infect: false }),
      buildAction("witch", { targets: [], heal: "p3" }),
    ];
    for (const action of built) expect(gameActionSchema.safeParse(action).success).toBe(true);
    expect(built[1]).toEqual({ type: "vote", target: null });
    expect(built[6]).toEqual({ type: "witch", heal: "p3", poison: null });
  });

  it("waits until the selection is complete", () => {
    expect(buildAction("seerInspect", { targets: [] })).toBeNull();
    expect(buildAction("cupidLink", { targets: ["p1"] })).toBeNull();
    expect(buildAction("wolfHoundChoose", { targets: [] })).toBeNull();
    expect(buildAction("infect", { targets: [] })).toBeNull();
  });

  it("toggleTarget keeps at most `max`, dropping the oldest", () => {
    expect(toggleTarget([], "a", 2)).toEqual(["a"]);
    expect(toggleTarget(["a", "b"], "c", 2)).toEqual(["b", "c"]);
    expect(toggleTarget(["a", "b"], "a", 2)).toEqual(["b"]);
  });
});
