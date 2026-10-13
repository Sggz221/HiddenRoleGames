import type { PlayerId } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { chatAccessFor, chatRecipients } from "./chat.js";
import type { GameState } from "./state.js";
import { act, advanceTo, idOf, setup } from "./test-utils.js";
import { projectFor } from "./view.js";

const kill = (state: GameState, id: PlayerId): GameState => ({
  ...state,
  players: state.players.map((p) => (p.id === id ? { ...p, alive: false } : p)),
});

const readers = (state: GameState, channel: Parameters<typeof chatRecipients>[1]) =>
  chatRecipients(state, channel).map((r) => r.id);

const DECK = [
  "werewolf",
  "werewolf",
  "seer",
  "little-girl",
  "cupid",
  "villager",
  "villager",
] as const;

/** Night 1 with p4 (Cupid) having linked p2 (Seer) and p5 (villager). */
function nightWithLovers(): GameState {
  const { state } = setup([...DECK]);
  const linked = act(state, idOf(state, "cupid"), { type: "cupidLink", targets: ["p2", "p5"] });
  return advanceTo(linked, { kind: "night", step: "wolves" });
}

describe("chat channels", () => {
  it("at night only the pack writes; villagers cannot talk in general", () => {
    const state = nightWithLovers();
    expect(chatAccessFor(state, "p0").write).toEqual(["wolves"]);
    expect(chatAccessFor(state, "p6").write).toEqual([]);
    expect(chatAccessFor(state, "p6").read).toEqual(["general"]);
  });

  it("by day the living write in general and the wolves channel closes", () => {
    const state = advanceTo(nightWithLovers(), { kind: "day", step: "debate" });
    expect(chatAccessFor(state, "p0").write).toEqual(["general"]);
    expect(chatAccessFor(state, "p0").read).toContain("wolves");
    expect(chatAccessFor(state, "p6").write).toEqual(["general"]);
  });

  it("the Little Girl reads the wolves anonymously; wolves see each other's names", () => {
    const state = nightWithLovers();
    const recipients = chatRecipients(state, "wolves");
    expect(recipients).toEqual([
      { id: "p0", anonymous: false },
      { id: "p1", anonymous: false },
      { id: idOf(state, "little-girl"), anonymous: true },
    ]);
    expect(chatAccessFor(state, "p3").write).not.toContain("wolves");
  });

  it("the Little Girl stops spying when the village loses its powers", () => {
    const state = { ...nightWithLovers(), villagePowersLost: true };
    expect(readers(state, "wolves")).toEqual(["p0", "p1"]);
  });

  it("an infected villager joins the pack's channel with names", () => {
    const base = nightWithLovers();
    const state = {
      ...base,
      players: base.players.map((p) =>
        p.id === "p6" ? { ...p, side: "wolves" as const, infected: true } : p,
      ),
    };
    expect(chatRecipients(state, "wolves")).toContainEqual({ id: "p6", anonymous: false });
    expect(chatAccessFor(state, "p6").write).toContain("wolves");
  });

  it("lovers share a private channel that Cupid cannot read", () => {
    const state = nightWithLovers();
    expect(readers(state, "lovers")).toEqual(["p2", "p5"]);
    expect(chatAccessFor(state, "p2").write).toContain("lovers");
    expect(chatAccessFor(state, "p4").read).not.toContain("lovers");
  });

  it("the dead talk among themselves and, by default, read the secret channels", () => {
    const state = kill(nightWithLovers(), "p6");
    expect(chatAccessFor(state, "p6")).toEqual({
      write: ["dead"],
      read: ["general", "wolves", "dead", "lovers"],
    });
    expect(readers(state, "dead")).toEqual(["p6"]);
    expect(chatRecipients(state, "wolves")).toContainEqual({ id: "p6", anonymous: false });
  });

  it("without deadSeeEverything the dead only read general and dead", () => {
    const { state } = setup([...DECK], { deadSeeEverything: false });
    const dead = kill(state, "p6");
    expect(chatAccessFor(dead, "p6").read).toEqual(["general", "dead"]);
    expect(readers(dead, "wolves")).not.toContain("p6");
  });

  it("the living never read the dead channel; dead lovers lose the lovers channel", () => {
    const state = kill(nightWithLovers(), "p5");
    expect(readers(state, "dead")).toEqual(["p5"]);
    expect(chatAccessFor(state, "p5").write).toEqual(["dead"]);
  });

  it("after the end everyone reads everything and only general is open", () => {
    const state: GameState = {
      ...nightWithLovers(),
      phase: { kind: "ended" },
      result: { team: "village", winners: [] },
    };
    expect(chatAccessFor(state, "p6")).toEqual({
      write: ["general"],
      read: ["general", "wolves", "dead", "lovers"],
    });
    expect(chatRecipients(state, "general").every((r) => !r.anonymous)).toBe(true);
  });

  it("is part of the player's view", () => {
    const state = nightWithLovers();
    expect(projectFor(state, "p0").chat).toEqual(chatAccessFor(state, "p0"));
  });

  it("unknown players get no access", () => {
    expect(chatAccessFor(nightWithLovers(), "nobody")).toEqual({ write: [], read: [] });
  });
});
