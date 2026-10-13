import type { PendingAction, PlayerView, PublicPlayer, SelfView } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { chooseAction, createRng } from "./strategy.js";

const player = (id: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id,
  name: id,
  seat: 0,
  alive: true,
  isSheriff: false,
  ...extra,
});

function view(
  pending: PendingAction | null,
  you: Partial<SelfView> = {},
  extra: Partial<PlayerView> = {},
): PlayerView {
  return {
    day: 1,
    phase: { kind: "night", step: "wolves" },
    revealOnDeath: "role",
    you: {
      id: "me",
      role: "villager",
      side: "village",
      alive: true,
      infected: false,
      charmed: false,
      lover: null,
      sisters: [],
      wildChildModel: null,
      wolfHoundSide: null,
      witchPotions: null,
      foxActive: null,
      salvadorLast: null,
      canSpyWolves: false,
      seerResults: [],
      foxResults: [],
      ...you,
    },
    players: [player("me"), player("a"), player("b"), player("c")],
    pending,
    votes: {},
    wolfVotes: null,
    nightVictims: null,
    result: null,
    chat: { write: [], read: ["general"] },
    ...extra,
  };
}

describe("chooseAction", () => {
  it("does nothing without pending options", () => {
    expect(chooseAction(view(null), createRng(1))).toBeNull();
  });

  it("only targets players the server offered", () => {
    for (let seed = 0; seed < 50; seed++) {
      const action = chooseAction(
        view({ types: ["seerInspect", "skip"], targets: ["b"] }),
        createRng(seed),
      );
      expect(action).toEqual({ type: "seerInspect", target: "b" });
    }
  });

  it("links two different lovers", () => {
    for (let seed = 0; seed < 50; seed++) {
      const action = chooseAction(
        view({ types: ["cupidLink", "skip"], targets: ["me", "a", "b"] }),
        createRng(seed),
      );
      if (action?.type !== "cupidLink") throw new Error("expected cupidLink");
      expect(action.targets[0]).not.toBe(action.targets[1]);
    }
  });

  it("wolves do not vote for their allies when there is someone else", () => {
    const players = [
      player("me"),
      player("a", { isWolfAlly: true }),
      player("b", { isWolfAlly: false }),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const action = chooseAction(
        view({ types: ["vote"], targets: ["a", "b"] }, { side: "wolves" }, { players }),
        createRng(seed),
      );
      expect(action).toEqual({ type: "vote", target: "b" });
    }
  });

  it("the Witch only heals tonight's victims and only with potions left", () => {
    for (let seed = 0; seed < 50; seed++) {
      const action = chooseAction(
        view(
          { types: ["witch", "skip"], targets: ["a", "b", "c"] },
          { role: "witch", witchPotions: { heal: true, poison: false } },
          { nightVictims: ["c"] },
        ),
        createRng(seed),
      );
      if (action?.type !== "witch") throw new Error("expected witch");
      expect([null, "c"]).toContain(action.heal);
      expect(action.poison).toBeNull();
    }
  });

  it("skips a targeted action with no targets when allowed", () => {
    expect(
      chooseAction(view({ types: ["piperCharm", "skip"], targets: [] }), createRng(3)),
    ).toEqual({
      type: "skip",
    });
  });

  it("abstains when there is nobody to vote for", () => {
    expect(chooseAction(view({ types: ["vote"], targets: [] }), createRng(3))).toEqual({
      type: "vote",
      target: null,
    });
  });

  it("is reproducible for a given seed", () => {
    const pending = { types: ["wolfVote" as const], targets: ["a", "b", "c"] };
    const run = () => chooseAction(view(pending), createRng(99));
    expect(run()).toEqual(run());
  });
});
