import type { GameEvent } from "@aullidos/shared";
import { describe, expect, it } from "vitest";
import { applyAction } from "./actions.js";
import {
  act,
  advance,
  advanceTo,
  advanceToNext,
  alive,
  everyoneVotes,
  setup,
} from "./test-utils.js";

const V = "villager" as const;

describe("Witch", () => {
  it("heals the wolves' victim and poisons someone else the same night (§3.4 #1)", () => {
    let { state } = setup(["werewolf", "witch", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "night", step: "witch" });
    state = act(state, "p1", { type: "witch", heal: "p2", poison: "p3" });
    state = advanceTo(state, { kind: "day" });
    expect(alive(state, "p2")).toBe(true);
    expect(alive(state, "p3")).toBe(false);
    expect(state.witchHealUsed && state.witchPoisonUsed).toBe(true);
  });

  it("can only heal tonight's wolf victims and each potion only once", () => {
    let { state } = setup(["werewolf", "witch", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "night", step: "witch" });
    expect(applyAction(state, "p1", { type: "witch", heal: "p3", poison: null }).ok).toBe(false);
    state = act(state, "p1", { type: "witch", heal: null, poison: "p4" });
    state = advanceToNext(state, { kind: "night", step: "witch" });
    expect(applyAction(state, "p1", { type: "witch", heal: null, poison: "p3" })).toMatchObject({
      ok: false,
      error: { code: "POTION_USED" },
    });
  });
});

describe("Cupid and the lovers", () => {
  it("chain: wolves kill a lover, the Hunter lover dies of grief and shoots (§3.4 #2)", () => {
    let { state } = setup(["werewolf", "cupid", "hunter", V, V, V, V]);
    state = act(state, "p1", { type: "cupidLink", targets: ["p3", "p2"] });
    state = advance(state);
    expect(state.lovers).toEqual(["p3", "p2"]);
    state = act(state, "p0", { type: "wolfVote", target: "p3" });
    state = advanceTo(state, { kind: "reaction" });
    expect(alive(state, "p3") || alive(state, "p2")).toBe(false);
    expect(state.phase).toMatchObject({ decision: { kind: "hunter-shot", actor: "p2" } });

    state = act(state, "p2", { type: "hunterShoot", target: "p0" });
    state = advance(state);
    expect(state.result?.team).toBe("village");
  });

  it("a mixed couple wins alone when they are the last two standing", () => {
    let { state } = setup(["werewolf", "cupid", V, V, V]);
    state = act(state, "p1", { type: "cupidLink", targets: ["p0", "p2"] });
    state = advanceTo(state, { kind: "day", step: "vote" });
    for (const id of ["p1", "p3"]) state.players.find((p) => p.id === id)!.alive = false;
    state = act(state, "p0", { type: "vote", target: "p4" });
    state = advance(state);
    expect(state.result).toEqual({ team: "lovers", winners: ["p0", "p2"] });
  });
});

describe("Hunter", () => {
  it("killed at night shoots at dawn, which can chain into more deaths (§3.4 #3)", () => {
    let { state } = setup(["werewolf", "werewolf", "hunter", "cupid", V, V, V, V, V]);
    state = act(state, "p3", { type: "cupidLink", targets: ["p4", "p5"] });
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = act(state, "p1", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "reaction" });
    state = act(state, "p2", { type: "hunterShoot", target: "p4" });
    state = advance(state);
    expect(alive(state, "p4") || alive(state, "p5")).toBe(false);
    expect(state.phase.kind).toBe("day");
  });

  it("may decline or time out without shooting", () => {
    let { state } = setup(["werewolf", "hunter", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    state = advanceTo(state, { kind: "reaction" });
    state = advance(state); // timeout
    expect(state.players.filter((p) => !p.alive).map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("Elder", () => {
  it("survives the first wolf attack and dies on the second", () => {
    let { state } = setup(["werewolf", "elder", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    state = advanceTo(state, { kind: "day" });
    expect(alive(state, "p1")).toBe(true);
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    state = advanceTo(state, { kind: "day" });
    expect(alive(state, "p1")).toBe(false);
    expect(state.villagePowersLost).toBe(false);
  });

  it("killed by the village vote makes villagers lose their powers", () => {
    const log: GameEvent[] = [];
    let { state } = setup(["werewolf", "elder", "seer", V, V, V]);
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = everyoneVotes(state, "p1");
    state = advanceTo(state, { kind: "night", step: "seer" }, log);
    expect(state.villagePowersLost).toBe(true);
    expect(log.some((event) => event.type === "villagePowersLost")).toBe(true);
    expect(applyAction(state, "p2", { type: "seerInspect", target: "p0" }).ok).toBe(false);
  });
});

describe("Infected Father of the Wolves", () => {
  it("turns the victim into a wolf instead of killing; the Witch cannot cure it", () => {
    let { state } = setup(["werewolf", "infected-father", "witch", "seer", V, V, V, V, V]);
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p3" });
    state = advance(state);
    state = act(state, "p1", { type: "infect", infect: true });
    state = advance(state);
    expect(state.phase).toEqual({ kind: "night", step: "witch" });
    expect(applyAction(state, "p2", { type: "witch", heal: "p3", poison: null }).ok).toBe(false);
    state = advanceTo(state, { kind: "day" });

    const seer = state.players.find((p) => p.id === "p3")!;
    expect(seer).toMatchObject({ alive: true, side: "wolves", infected: true, role: "seer" });
    expect(state.infectUsed).toBe(true);
  });

  it("cannot infect the Elder: the attack resolves normally", () => {
    let { state } = setup(["werewolf", "infected-father", "elder", V, V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advance(state);
    state = act(state, "p1", { type: "infect", infect: true });
    state = advanceTo(state, { kind: "day" });
    expect(state.players[2]).toMatchObject({ alive: true, side: "village", infected: false });
    expect(state.elderLivesLost).toBe(1);
  });
});

describe("Big Bad Wolf", () => {
  it("kills a second victim while no wolf has died", () => {
    let { state } = setup(["werewolf", "big-bad-wolf", V, V, V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advance(state);
    expect(applyAction(state, "p1", { type: "bigBadWolfKill", target: "p2" }).ok).toBe(false);
    state = act(state, "p1", { type: "bigBadWolfKill", target: "p3" });
    state = advanceTo(state, { kind: "day" });
    expect(alive(state, "p2") || alive(state, "p3")).toBe(false);

    state = advanceTo(state, { kind: "day", step: "vote" });
    state = everyoneVotes(state, "p0");
    state = advanceTo(state, { kind: "night", step: "big-bad-wolf" });
    expect(applyAction(state, "p1", { type: "bigBadWolfKill", target: "p4" }).ok).toBe(false);
  });
});

describe("White Werewolf", () => {
  it("kills a wolf every other night and wins as the sole survivor", () => {
    let { state } = setup(["werewolf", "white-werewolf", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "night", step: "white-werewolf" });
    expect(state.day).toBe(2);
    state = act(state, "p1", { type: "whiteWolfKill", target: "p0" });
    for (const id of ["p3", "p4", "p5"]) state.players.find((p) => p.id === id)!.alive = false;
    state = advanceTo(state, { kind: "ended" });
    expect(state.result).toEqual({ team: "white-werewolf", winners: ["p1"] });
  });

  it("does not let the pack win while he is still alive among them", () => {
    let { state } = setup(["werewolf", "white-werewolf", V, V, V, V]);
    for (const id of ["p3", "p4", "p5"]) state.players.find((p) => p.id === id)!.alive = false;
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "day" });
    expect(state.result).toBeNull();
  });
});

describe("Knight with the Rusty Sword", () => {
  it("the first wolf to his left dies at the next dawn", () => {
    // Seats: p0 knight, p1 villager, p2 wolf, p3 wolf ...
    let { state } = setup(["knight", V, "werewolf", "werewolf", V, V, V, V, V]);
    state = act(state, "p2", { type: "wolfVote", target: "p0" });
    state = act(state, "p3", { type: "wolfVote", target: "p0" });
    state = advanceTo(state, { kind: "day" });
    expect(alive(state, "p0")).toBe(false);
    expect(state.rustVictim).toBe("p2");
    state = advanceTo(state, { kind: "day", step: "debate" }, undefined, 5);
    state = advanceTo(state, { kind: "night" });
    const log: GameEvent[] = [];
    state = advanceTo(state, { kind: "day" }, log);
    expect(alive(state, "p2")).toBe(false);
    expect(log.find((e) => e.type === "playerDied")).toMatchObject({ player: "p2", cause: "rust" });
  });
});

describe("Fox", () => {
  it("keeps the power while a wolf is among the three and loses it otherwise", () => {
    // Table: p0 fox, p1 V, p2 V, p3 V, p4 wolf, p5 V
    let { state } = setup(["fox", V, V, V, "werewolf", V]);
    state = advanceTo(state, { kind: "night", step: "fox" });
    state = act(state, "p0", { type: "foxSniff", target: "p5" }); // p4,p5,p0 → wolf
    state = advanceToNext(state, { kind: "night", step: "fox" });
    expect(state.foxActive).toBe(true);
    state = act(state, "p0", { type: "foxSniff", target: "p2" }); // p1,p2,p3 → none
    state = advanceTo(state, { kind: "day" });
    expect(state.foxActive).toBe(false);
    expect(state.foxResults.map((r) => r.wolfNearby)).toEqual([true, false]);
  });
});

describe("Bear Tamer", () => {
  it("growls in the morning when a wolf sits next to him", () => {
    const log: GameEvent[] = [];
    let { state } = setup(["bear-tamer", "werewolf", V, V, V, V]);
    state = advanceTo(state, { kind: "day" }, log);
    expect(log.some((event) => event.type === "bearGrowled")).toBe(true);
  });
});

describe("Wild Child", () => {
  it("joins the pack after the role model dies", () => {
    let { state } = setup(["wild-child", "werewolf", V, V, V, V, V]);
    state = act(state, "p0", { type: "wildChildModel", target: "p2" });
    state = advance(state);
    state = act(state, "p1", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "day" });
    expect(state.players[0]?.side).toBe("wolves");
  });
});

describe("Wolf Hound", () => {
  it("joins the pack on the first night if he chooses the wolves", () => {
    let { state } = setup(["wolf-hound", "werewolf", V, V, V, V]);
    state = act(state, "p0", { type: "wolfHoundChoose", side: "wolves" });
    state = advance(state);
    expect(state.phase).toEqual({ kind: "night", step: "wolves" });
    expect(applyAction(state, "p0", { type: "wolfVote", target: "p2" }).ok).toBe(true);
  });

  it("defaults to the village when he does not choose", () => {
    let { state } = setup(["wolf-hound", "werewolf", V, V, V, V]);
    state = advance(state);
    expect(state.players[0]?.side).toBe("village");
  });
});

describe("Piper", () => {
  it("wins when every other living player is charmed", () => {
    let { state } = setup(["piper", "werewolf", V, V, V]);
    state = advanceTo(state, { kind: "night", step: "piper" });
    state = act(state, "p0", { type: "piperCharm", targets: ["p1", "p2"] });
    state = advanceToNext(state, { kind: "night", step: "piper" });
    expect(applyAction(state, "p0", { type: "piperCharm", targets: ["p1", "p3"] }).ok).toBe(false);
    state = act(state, "p0", { type: "piperCharm", targets: ["p3", "p4"] });
    state = advanceTo(state, { kind: "ended" });
    expect(state.result).toEqual({ team: "piper", winners: ["p0"] });
  });
});

describe("Angel", () => {
  it("wins immediately when voted out on the opening day", () => {
    let { state } = setup(["werewolf", "angel", V, V, V]);
    state = advance(state); // debate → vote
    state = everyoneVotes(state, "p1");
    state = advance(state);
    expect(state.result).toEqual({ team: "angel", winners: ["p1"] });
  });

  it("becomes a simple villager after the first turn", () => {
    let { state } = setup(["werewolf", "angel", V, V, V, V]);
    state = advanceTo(state, { kind: "day", step: "vote" }, undefined, 3);
    state = advance(everyoneVotes(state, "p2")); // day 0
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = everyoneVotes(state, "p1"); // day 1
    state = advance(state);
    expect(state.result).toBeNull();
    expect(alive(state, "p1")).toBe(false);
  });
});

describe("game end", () => {
  it("wolves win when only wolves remain", () => {
    let { state } = setup(["werewolf", "werewolf", V, V, V, V, V, V]);
    for (const id of ["p3", "p4", "p5", "p6", "p7"])
      state.players.find((p) => p.id === id)!.alive = false;
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "ended" });
    expect(state.result).toEqual({ team: "wolves", winners: ["p0", "p1"] });
  });

  it("nobody wins when the last shot leaves no survivors", () => {
    let { state } = setup(["werewolf", "hunter", V, V, V]);
    for (const id of ["p2", "p3", "p4"]) state.players.find((p) => p.id === id)!.alive = false;
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    state = advanceTo(state, { kind: "reaction" });
    state = act(state, "p1", { type: "hunterShoot", target: "p0" });
    state = advance(state);
    expect(state.result).toEqual({ team: "none", winners: [] });
  });
});
