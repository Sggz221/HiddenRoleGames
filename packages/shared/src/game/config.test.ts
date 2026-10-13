import { describe, expect, it } from "vitest";
import { deckIssues, recommendedDeck, validateDeck } from "./config.js";

describe("deckIssues", () => {
  it("accepts every recommended deck", () => {
    for (let players = 5; players <= 20; players++) {
      expect(deckIssues(recommendedDeck(players))).toEqual([]);
    }
  });

  it("reports each broken rule with the data the lobby needs", () => {
    expect(deckIssues(["villager", "villager", "villager", "seer", "seer"])).toEqual([
      { kind: "tooManyCopies", role: "seer", count: 2, max: 1 },
      { kind: "noWolves" },
    ]);
    expect(deckIssues(["werewolf", "werewolf", "werewolf", "sister", "villager"])).toEqual([
      { kind: "exactCopies", role: "sister", count: 1, required: 2 },
      { kind: "wolvesMajority", wolves: 3, others: 2 },
    ]);
  });

  it("keeps the developer messages of validateDeck", () => {
    expect(validateDeck(["villager", "villager", "villager", "villager", "villager"])).toEqual([
      "The deck needs at least one wolf",
    ]);
  });
});
