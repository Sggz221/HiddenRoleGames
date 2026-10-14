import type { GameEvent, NarrationLine, PlayerId, RoleId } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { narrate } from "./narration.js";
import type { GameState } from "./state.js";
import { act, advance, advanceTo, everyoneVotes, setup } from "./test-utils.js";
import { eventsFor } from "./view.js";

const V = "villager" as const;

/** What `viewer` hears for a batch of events. */
const heard = (state: GameState, viewer: PlayerId, events: GameEvent[]): NarrationLine[] =>
  narrate(state, eventsFor(state, viewer, events), viewer);

const keys = (lines: NarrationLine[]) => lines.map((line) => line.key);

/** Advances once and returns the new state with what `viewer` heard. */
function step(state: GameState, viewer: PlayerId): [GameState, NarrationLine[]] {
  const log: GameEvent[] = [];
  const next = advance(state, log);
  return [next, heard(next, viewer, log)];
}

/** Plays the night up to (and including) the dawn batch. */
function untilDawn(state: GameState, viewer: PlayerId): [GameState, NarrationLine[]] {
  const log: GameEvent[] = [];
  let current = state;
  while (current.phase.kind === "night") current = advance(current, log);
  return [current, heard(current, viewer, log)];
}

describe("narration: start of the game", () => {
  it("announces the game, tells each player only their own role and lets the night fall", () => {
    const { state, events } = setup(["werewolf", "seer", V, V, V]);
    const lines = heard(state, "p2", events);
    expect(lines).toEqual([
      { key: "game.started", params: { count: 5 } },
      { key: "game.yourRole", params: { role: "villager" } },
      { key: "night.falls", params: { day: 1 } },
      { key: "night.wakes.seer", params: {} },
    ]);
  });

  it("wakes each night role in order, and the wolves", () => {
    let { state } = setup(["werewolf", "seer", "witch", V, V]);
    let lines: NarrationLine[];
    [state, lines] = step(state, "p3");
    expect(keys(lines)).toEqual(["night.wakes.wolves"]);
    [state, lines] = step(state, "p3");
    expect(keys(lines)).toEqual(["night.wakes.witch"]);
  });

  it("starts with the debate when the Angel opens the game by day", () => {
    const { state, events } = setup(["werewolf", "angel", V, V, V]);
    expect(keys(heard(state, "p2", events))).toEqual([
      "game.started",
      "game.yourRole",
      "day.debate",
    ]);
  });
});

describe("narration: dawn", () => {
  it("nobody died", () => {
    let { state } = setup(["werewolf", "witch", V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advanceTo(state, { kind: "night", step: "witch" });
    state = act(state, "p1", { type: "witch", heal: "p2", poison: null });
    const [, lines] = untilDawn(state, "p3");
    expect(keys(lines)).toEqual(["dawn.nobody", "day.debate"]);
  });

  it("one death, revealing the role", () => {
    let { state } = setup(["werewolf", "seer", V, V, V]);
    state = advance(state);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    const [, lines] = untilDawn(state, "p3");
    expect(lines).toEqual([
      { key: "dawn.one", params: { count: 1 } },
      {
        key: "death.night.role",
        params: { player: { id: "p2", name: "Player 2" }, role: "villager", side: "village" },
      },
      { key: "day.debate", params: { day: 1 } },
    ]);
  });

  it("several deaths: the wolves' victim and the lover who dies of grief", () => {
    let { state } = setup(["werewolf", "cupid", V, V, V, V]);
    state = act(state, "p1", { type: "cupidLink", targets: ["p2", "p3"] });
    state = advance(state);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    const [, lines] = untilDawn(state, "p4");
    expect(keys(lines)).toEqual([
      "dawn.many",
      "death.night.role",
      "death.grief.role",
      "day.debate",
    ]);
    expect(lines[0]?.params.count).toBe(2);
  });

  it.each([
    ["side", "death.night.side", { side: "village" }],
    ["none", "death.night.hidden", {}],
  ] as const)("revealOnDeath=%s hides what it must", (reveal, key, extra) => {
    let { state } = setup(["werewolf", "seer", V, V, V], { revealOnDeath: reveal });
    state = advance(state);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    const [, lines] = untilDawn(state, "p3");
    expect(lines[1]).toEqual({ key, params: { player: { id: "p2", name: "Player 2" }, ...extra } });
  });

  it("the bear growls for everyone", () => {
    const { state } = setup(["bear-tamer", "werewolf", V, V, V, V]);
    const [, lines] = untilDawn(state, "p3");
    expect(keys(lines)).toContain("bear.growled");
  });
});

describe("narration: day", () => {
  /** A 6-player game at the first day vote, with nobody killed overnight. */
  const atVote = (config: Parameters<typeof setup>[1] = {}, roles: RoleId[] = []) => {
    let { state } = setup(["werewolf", "seer", V, V, V, V, ...roles], config);
    state = advanceTo(state, { kind: "day", step: "debate" });
    return advance(state);
  };

  it("calls the vote and announces who is eliminated, then night falls again", () => {
    let state = atVote();
    state = everyoneVotes(state, "p2");
    const [, lines] = step(state, "p3");
    expect(keys(lines)).toEqual([
      "vote.eliminated",
      "death.vote.role",
      "night.falls",
      "night.wakes.seer",
    ]);
    expect(lines[2]?.params.day).toBe(2);
  });

  it("a tie with no elimination names the tied players", () => {
    let state = atVote({ voteTieRule: "no-elimination" });
    state = act(state, "p0", { type: "vote", target: "p2" });
    state = act(state, "p1", { type: "vote", target: "p3" });
    const [, lines] = step(state, "p4");
    expect(lines[0]).toEqual({
      key: "vote.tie",
      params: {
        players: [
          { id: "p2", name: "Player 2" },
          { id: "p3", name: "Player 3" },
        ],
      },
    });
  });

  it("a tie with runoff announces the runoff candidates", () => {
    let state = atVote({ voteTieRule: "runoff" });
    state = act(state, "p0", { type: "vote", target: "p2" });
    state = act(state, "p1", { type: "vote", target: "p3" });
    const [, lines] = step(state, "p4");
    expect(keys(lines)).toEqual(["vote.runoff"]);
  });

  it("nobody voted", () => {
    const [, lines] = step(atVote(), "p4");
    expect(keys(lines)[0]).toBe("vote.nobody");
  });

  it("the sheriff election and its result", () => {
    let { state } = setup(["werewolf", "seer", V, V, V, V], { sheriff: true });
    state = advanceTo(state, { kind: "night", step: "wolves" });
    let lines: NarrationLine[];
    [state, lines] = untilDawn(state, "p3");
    expect(keys(lines)).toEqual(["dawn.nobody", "day.sheriffElection"]);
    state = everyoneVotes(state, "p3");
    [, lines] = step(state, "p4");
    expect(lines).toEqual([
      { key: "sheriff.elected", params: { player: { id: "p3", name: "Player 3" } } },
      { key: "day.debate", params: { day: 1 } },
    ]);
  });

  it("the Hunter's last shot: the reaction and the death it causes", () => {
    let { state } = setup(["werewolf", "hunter", V, V, V, V]);
    state = act(state, "p0", { type: "wolfVote", target: "p1" });
    let lines: NarrationLine[];
    [state, lines] = untilDawn(state, "p3");
    expect(keys(lines)).toEqual(["dawn.one", "death.night.role", "reaction.hunter-shot"]);
    expect(lines[2]?.params.player).toEqual({ id: "p1", name: "Player 1" });
    state = act(state, "p1", { type: "hunterShoot", target: "p2" });
    [, lines] = step(state, "p3");
    expect(keys(lines)).toEqual(["death.hunter.role", "day.debate"]);
  });
});

describe("narration: end of the game", () => {
  it("announces the winning team and its players", () => {
    let { state } = setup(["werewolf", "seer", V, V, V]);
    state = advanceTo(state, { kind: "day", step: "debate" });
    state = advance(state);
    state = everyoneVotes(state, "p0");
    const [, lines] = step(state, "p2");
    expect(keys(lines)).toEqual(["vote.eliminated", "death.vote.role", "end.village"]);
    expect(lines[2]?.params.players?.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

describe("narration: privacy", () => {
  it("only the pack hears the wolves' choice and only the seer hears her vision", () => {
    let { state } = setup(["werewolf", "seer", V, V, V]);
    state = act(state, "p1", { type: "seerInspect", target: "p0" });
    const log: GameEvent[] = [];
    state = advance(state, log);
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = advance(state, log);

    expect(keys(heard(state, "p1", log))).toContain("private.seerResult");
    expect(keys(heard(state, "p0", log))).toContain("private.wolvesChoseVictim");
    const villager = keys(heard(state, "p3", log));
    expect(villager.some((key) => key.startsWith("private."))).toBe(false);
  });
});

describe("narration: what the dead witness", () => {
  it("tells the dead the Seer's vision in the third person, naming the Seer", () => {
    let { state } = setup(["werewolf", "seer", V, V, V]);
    state.players[4]!.alive = false;
    state = act(state, "p1", { type: "seerInspect", target: "p0" });
    const log: GameEvent[] = [];
    state = advance(state, log);

    expect(heard(state, "p1", log)).toContainEqual({
      key: "private.seerResult",
      params: { player: { id: "p0", name: "Player 0" }, role: "werewolf" },
    });
    expect(heard(state, "p4", log)).toContainEqual({
      key: "witness.seerResult",
      params: {
        actor: { id: "p1", name: "Player 1" },
        player: { id: "p0", name: "Player 0" },
        role: "werewolf",
      },
    });
  });

  it("tells an infected player that they joined the pack, in the second person", () => {
    let { state } = setup(["infected-father", "werewolf", V, V, V, V]);
    state = advanceTo(state, { kind: "night", step: "wolves" });
    state = act(state, "p0", { type: "wolfVote", target: "p2" });
    state = act(state, "p1", { type: "wolfVote", target: "p2" });
    state = advance(state);
    state = act(state, "p0", { type: "infect", infect: true });
    const log: GameEvent[] = [];
    state = advance(state, log);

    expect(keys(heard(state, "p2", log))).toContain("private.youAreInfected");
    expect(keys(heard(state, "p1", log))).toContain("private.playerInfected");
  });
});
