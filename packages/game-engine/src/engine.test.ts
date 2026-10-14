import { type GameEvent, gameConfigSchema } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { applyAction } from "./actions.js";
import { advancePhase, canAdvanceEarly, nightSteps } from "./advance.js";
import { createGame } from "./create.js";
import { act, advance, advanceTo, alive, everyoneVotes, idOf, setup } from "./test-utils.js";

describe("createGame", () => {
  const config = gameConfigSchema.parse({
    roles: ["werewolf", "seer", "villager", "villager", "villager"],
  });
  const players = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id }));

  it("deals every card exactly once and is deterministic for a seed", () => {
    const first = createGame(config, players, 7).state;
    const second = createGame(config, players, 7).state;
    expect(first.players.map((p) => p.role).sort()).toEqual([...config.roles].sort());
    expect(second.players.map((p) => p.role)).toEqual(first.players.map((p) => p.role));
  });

  it("sends each player only their own role", () => {
    const { events } = createGame(config, players, 7);
    const roleEvents = events.filter((event) => event.type === "roleAssigned");
    expect(roleEvents).toHaveLength(5);
    for (const event of roleEvents) {
      expect(event.audience).toEqual({ kind: "players", ids: [expect.any(String)] });
    }
  });

  it("rejects a deck that does not match the table", () => {
    expect(() => createGame(config, players.slice(0, 4), 1)).toThrow(RangeError);
  });

  it("starts at night 1, or with a day vote when the Angel is in the deck", () => {
    expect(setup(["werewolf", "seer", "villager", "villager", "villager"]).state.phase).toEqual({
      kind: "night",
      step: "seer",
    });
    const withAngel = setup(["werewolf", "angel", "villager", "villager", "villager"]).state;
    expect(withAngel.phase).toEqual({ kind: "day", step: "debate" });
    expect(withAngel.day).toBe(0);
  });
});

describe("night steps", () => {
  it("follow the official order and only include first-night roles on night 1", () => {
    const { state } = setup([
      "werewolf",
      "white-werewolf",
      "cupid",
      "seer",
      "witch",
      "wild-child",
      "fox",
      "piper",
      "villager",
    ]);
    expect(nightSteps(state, 1)).toEqual([
      "cupid",
      "seer",
      "wild-child",
      "wolves",
      "witch",
      "fox",
      "piper",
    ]);
    expect(nightSteps(state, 2)).toEqual([
      "seer",
      "wolves",
      "white-werewolf",
      "witch",
      "fox",
      "piper",
    ]);
  });

  it("keep the step for a dead role so the night length leaks nothing", () => {
    let { state } = setup(["werewolf", "seer", "villager", "villager", "villager"]);
    state.players[1]!.alive = false;
    state = advanceTo(state, { kind: "night", step: "wolves" }); // seer step still runs
    expect(state.day).toBe(1);
    expect(nightSteps(state, 2)).toContain("seer");
  });

  it("never allow skipping the timer at night", () => {
    let { state } = setup(["werewolf", "seer", "villager", "villager", "villager"]);
    state = act(state, idOf(state, "seer"), { type: "seerInspect", target: "p0" });
    expect(canAdvanceEarly(state)).toBe(false);
  });
});

describe("basic night and day cycle", () => {
  it("wolves kill at dawn and the seer learns a role privately", () => {
    const log: GameEvent[] = [];
    let { state } = setup(["werewolf", "seer", "villager", "villager", "villager"]);
    state = act(state, "p1", { type: "seerInspect", target: "p0" });
    state = advance(state, log);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "day", step: "debate" }, log);

    expect(alive(state, "p2")).toBe(false);
    const seerEvent = log.find((event) => event.type === "seerResult");
    expect(seerEvent).toMatchObject({
      role: "werewolf",
      audience: { kind: "players", ids: ["p1"] },
    });
    const death = log.find((event) => event.type === "playerDied");
    expect(death).toMatchObject({ player: "p2", cause: "night", audience: { kind: "all" } });
  });

  it("rejects actions from the wrong player, phase or target", () => {
    const { state } = setup(["werewolf", "seer", "villager", "villager", "villager"]);
    expect(applyAction(state, "p2", { type: "seerInspect", target: "p0" })).toMatchObject({
      ok: false,
      error: { code: "NOT_ALLOWED" },
    });
    expect(applyAction(state, "p1", { type: "seerInspect", target: "p1" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_TARGET" },
    });
    expect(applyAction(state, "p1", { type: "vote", target: "p0" })).toMatchObject({ ok: false });
  });

  it("does not mutate the input state", () => {
    const { state } = setup(["werewolf", "seer", "villager", "villager", "villager"]);
    const snapshot = JSON.stringify(state);
    act(state, "p1", { type: "seerInspect", target: "p0" });
    advancePhase(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("lynches the most voted player and lets the day end early once everyone voted", () => {
    let { state } = setup(["werewolf", "villager", "villager", "villager", "villager", "villager"]);
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = everyoneVotes(state, "p0");
    expect(canAdvanceEarly(state)).toBe(true);
    const log: GameEvent[] = [];
    state = advance(state, log);
    expect(alive(state, "p0")).toBe(false);
    expect(state.result?.team).toBe("village");
    expect(log.at(-1)).toMatchObject({ type: "gameEnded", audience: { kind: "all" } });
  });
});

describe("vote ties", () => {
  const roles = ["werewolf", "villager", "villager", "villager", "villager", "villager"] as const;

  function tiedVote(state: ReturnType<typeof setup>["state"]) {
    // p1,p2 → p3 ; p3,p4 → p1 ; p0,p5 abstain
    let s = state;
    s = act(s, "p1", { type: "vote", target: "p3" });
    s = act(s, "p2", { type: "vote", target: "p3" });
    s = act(s, "p3", { type: "vote", target: "p1" });
    s = act(s, "p4", { type: "vote", target: "p1" });
    return s;
  }

  it("runoff: tied players face a second vote; a second tie eliminates nobody", () => {
    let { state } = setup([...roles]);
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = advance(tiedVote(state));
    expect(state.phase).toEqual({ kind: "day", step: "runoff" });
    expect(state.runoffCandidates.sort()).toEqual(["p1", "p3"]);
    expect(applyAction(state, "p0", { type: "vote", target: "p2" }).ok).toBe(false);

    state = act(state, "p2", { type: "vote", target: "p3" });
    state = act(state, "p4", { type: "vote", target: "p1" });
    state = advance(state);
    expect(alive(state, "p1") && alive(state, "p3")).toBe(true);
    expect(state.phase.kind).toBe("night");
  });

  it("no-elimination rule ends the day without deaths", () => {
    let { state } = setup([...roles], { voteTieRule: "no-elimination" });
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = advance(tiedVote(state));
    expect(state.phase.kind).toBe("night");
    expect(state.players.every((p) => p.alive)).toBe(true);
  });

  it("sheriff rule lets the Sheriff pick among the tied players", () => {
    let { state } = setup([...roles], { voteTieRule: "sheriff" });
    state.sheriff = "p5";
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = advance(tiedVote(state));
    expect(state.phase).toMatchObject({
      kind: "reaction",
      decision: { kind: "sheriff-tiebreak", actor: "p5" },
    });
    state = act(state, "p5", { type: "sheriffTieBreak", target: "p3" });
    expect(canAdvanceEarly(state)).toBe(true);
    state = advance(state);
    expect(alive(state, "p3")).toBe(false);
  });

  it("the Sheriff's vote counts double", () => {
    let { state } = setup([...roles]);
    state.sheriff = "p1";
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = act(state, "p1", { type: "vote", target: "p3" }); // 2
    state = act(state, "p3", { type: "vote", target: "p1" }); // 1
    state = advance(state);
    expect(alive(state, "p3")).toBe(false);
  });
});

describe("sheriff", () => {
  it("is elected on the first day and names a successor when eliminated", () => {
    let { state } = setup(
      ["werewolf", "villager", "villager", "villager", "villager", "villager"],
      {
        sheriff: true,
      },
    );
    state = advanceTo(state, { kind: "day", step: "sheriff-election" });
    for (const voter of ["p1", "p2", "p3"])
      state = act(state, voter, { type: "vote", target: "p4" });
    state = advance(state);
    expect(state.sheriff).toBe("p4");
    expect(state.phase).toEqual({ kind: "day", step: "debate" });

    state = advance(state); // to vote
    state = everyoneVotes(state, "p4");
    state = advance(state);
    expect(state.phase).toMatchObject({
      kind: "reaction",
      decision: { kind: "sheriff-successor", actor: "p4" },
    });
    state = act(state, "p4", { type: "sheriffSuccessor", target: "p2" });
    state = advance(state);
    expect(state.sheriff).toBe("p2");
  });
});
