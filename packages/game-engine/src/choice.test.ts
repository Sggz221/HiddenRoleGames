import { describe, expect, it } from "vitest";
import { act, advance, advanceTo, setup } from "./test-utils.js";
import { projectFor } from "./view.js";

const V = "villager" as const;

describe("your choice in your own view", () => {
  it("shows the Seer's pick only to the Seer, and forgets it when she passes", () => {
    let { state } = setup(["werewolf", "seer", V, V, V]);
    state = act(state, "p1", { type: "seerInspect", target: "p0" });
    expect(projectFor(state, "p1").you.choice).toEqual({ type: "seerInspect", target: "p0" });
    expect(projectFor(state, "p2").you.choice).toBeNull();

    state = act(state, "p1", { type: "skip" });
    expect(projectFor(state, "p1").you.choice).toBeNull();
    const log: Parameters<typeof advance>[1] = [];
    state = advance(state, log);
    // Passing really withdraws the pick: no vision tonight.
    expect(log.some((event) => event.type === "seerResult")).toBe(false);
  });

  it("each wolf sees their own vote", () => {
    let { state } = setup(["werewolf", "werewolf", V, V, V, V, V]);
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    expect(projectFor(state, "p0").you.choice).toEqual({ type: "wolfVote", target: "p2" });
    expect(projectFor(state, "p1").you.choice).toBeNull();
  });

  it("remembers a day vote, including an abstention", () => {
    let { state } = setup(["werewolf", V, V, V, V]);
    state = advanceTo(state, { kind: "day", step: "vote" });
    state = act(state, "p1", { type: "vote", target: null });
    expect(projectFor(state, "p1").you.choice).toEqual({ type: "vote", target: null });
    expect(projectFor(state, "p2").you.choice).toBeNull();
  });

  it("remembers the Infected Father's answer, yes or no", () => {
    let { state } = setup(["infected-father", "werewolf", V, V, V, V]);
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advance(state);
    expect(projectFor(state, "p0").you.choice).toBeNull();
    state = act(state, "p0", { type: "infect", infect: false });
    expect(projectFor(state, "p0").you.choice).toEqual({ type: "infect", infect: false });
  });

  it("shows the Hunter's aim during his reaction", () => {
    let { state } = setup(["werewolf", "hunter", V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    state = advanceTo(state, { kind: "reaction" });
    expect(projectFor(state, "p1").you.choice).toBeNull();
    state = act(state, "p1", { type: "hunterShoot", target: "p0" });
    expect(projectFor(state, "p1").you.choice).toEqual({ type: "hunterShoot", target: "p0" });
  });

  it("the Witch passing drops both potions she had prepared", () => {
    let { state } = setup(["werewolf", "witch", V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "night", step: "witch" });
    state = act(state, "p1", { type: "witch", heal: "p2", poison: "p0" });
    expect(projectFor(state, "p1").you.choice).toEqual({ type: "witch", heal: "p2", poison: "p0" });
    state = act(state, "p1", { type: "skip" });
    state = advance(state);
    expect(state.witchHealUsed || state.witchPoisonUsed).toBe(false);
  });
});
