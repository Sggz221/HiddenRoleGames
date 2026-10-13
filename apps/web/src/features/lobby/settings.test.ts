import { recommendedDeck, roomStartSchema, timersSchema } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import {
  countsOf,
  deckFor,
  defaultSettings,
  PACE_TIMERS,
  PACES,
  parseSettings,
  setCount,
  startProblems,
  toRoomStart,
} from "./settings";

describe("lobby settings", () => {
  it("the recommended deck follows the table size", () => {
    const settings = defaultSettings(5);
    expect(deckFor(settings, 8)).toEqual(recommendedDeck(8));
    expect(startProblems(settings, 8)).toEqual([]);
  });

  it("cannot start below the minimum table", () => {
    expect(startProblems(defaultSettings(4), 4)).toEqual([
      { kind: "notEnoughPlayers", players: 4, min: 5 },
    ]);
  });

  it("a custom deck must have one card per player and follow the deck rules", () => {
    const settings = { ...defaultSettings(5), deck: "custom" as const };
    expect(startProblems(settings, 6)).toEqual([{ kind: "deckSize", cards: 5, players: 6 }]);

    const noWolves = { ...settings, counts: { villager: 5 } };
    expect(startProblems(noWolves, 5)).toEqual([{ kind: "noWolves" }]);
  });

  it("setCount respects each card's copy limit", () => {
    expect(setCount({}, "seer", 3)).toEqual({ seer: 1 });
    expect(setCount({ sister: 2 }, "sister", 5)).toEqual({ sister: 2 });
    expect(setCount({ seer: 1, villager: 3 }, "seer", 0)).toEqual({ villager: 3 });
    expect(setCount({}, "villager", 40)).toEqual({ villager: 20 });
  });

  it("builds a room:start payload the server accepts", () => {
    const recommended = toRoomStart(defaultSettings(6), 6);
    expect(recommended.roles).toBeUndefined();
    expect(roomStartSchema.safeParse(recommended).success).toBe(true);

    const custom = { ...defaultSettings(6), deck: "custom" as const, pace: "fast" as const };
    const payload = toRoomStart(custom, 6);
    expect(payload.roles).toEqual(deckFor(custom, 6));
    expect(roomStartSchema.safeParse(payload).success).toBe(true);
  });

  it("every pace is within the server's timer limits; normal is the default", () => {
    for (const pace of PACES) expect(timersSchema.safeParse(PACE_TIMERS[pace]).success).toBe(true);
    expect(PACE_TIMERS.normal).toEqual(timersSchema.parse({}));
  });

  it("countsOf groups the cards of a deck", () => {
    expect(countsOf(["werewolf", "villager", "villager"])).toEqual({ werewolf: 1, villager: 2 });
  });

  it("restores saved settings and ignores anything broken", () => {
    const saved = {
      ...defaultSettings(6),
      deck: "custom",
      pace: "slow",
      counts: { seer: 1, werewolf: 2 },
    };
    expect(parseSettings(JSON.stringify(saved), 6)).toEqual(saved);
    expect(parseSettings("not json", 6)).toEqual(defaultSettings(6));
    expect(parseSettings(null, 6)).toEqual(defaultSettings(6));
    const broken = { deck: "weird", pace: 3, sheriff: "yes", counts: { seer: 5, dragon: 2 } };
    expect(parseSettings(JSON.stringify(broken), 6)).toEqual({
      ...defaultSettings(6),
      counts: { seer: 1 },
    });
  });
});
