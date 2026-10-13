import { describe, expect, it } from "vitest";
import { SceneQueue } from "./queue";
import { scenesFor } from "./scenes";

describe("scenesFor", () => {
  it("a dawn shows the night's deaths, or that nobody died", () => {
    expect(
      scenesFor([
        { type: "dawn", day: 1 },
        { type: "playerDied", player: "p2", cause: "night", role: "seer", side: "village" },
        { type: "phaseChanged", phase: { kind: "day", step: "debate" }, day: 1 },
      ]),
    ).toEqual([
      { kind: "dawn", deaths: [{ player: "p2", cause: "night", role: "seer", side: "village" }] },
    ]);
    expect(scenesFor([{ type: "dawn", day: 2 }])).toEqual([{ kind: "dawn", deaths: [] }]);
  });

  it("a closed vote always gets a scene: who is out (and who follows), or why nobody", () => {
    expect(
      scenesFor([
        { type: "votesRevealed", votes: { p0: "p1", p2: "p1" } },
        { type: "voteResult", eliminated: "p1", tied: [] },
        { type: "playerDied", player: "p1", cause: "vote" },
        { type: "playerDied", player: "p3", cause: "grief" },
      ]),
    ).toEqual([
      {
        kind: "vote",
        outcome: "eliminated",
        tied: [],
        deaths: [
          { player: "p1", cause: "vote" },
          { player: "p3", cause: "grief" },
        ],
      },
    ]);
    expect(scenesFor([{ type: "voteResult", eliminated: null, tied: [] }])).toEqual([
      { kind: "vote", outcome: "nobody", tied: [], deaths: [] },
    ]);
    expect(scenesFor([{ type: "voteResult", eliminated: null, tied: ["p1", "p2"] }])).toEqual([
      { kind: "vote", outcome: "tie", tied: ["p1", "p2"], deaths: [] },
    ]);
    expect(scenesFor([{ type: "runoffStarted", candidates: ["p1", "p2"] }])).toEqual([
      { kind: "vote", outcome: "runoff", tied: ["p1", "p2"], deaths: [] },
    ]);
    expect(scenesFor([{ type: "sheriffElected", player: "p4" }])).toEqual([
      { kind: "sheriff", player: "p4", deaths: [] },
    ]);
  });

  it("other day deaths are one scene; a vote being cast does not stop the screen", () => {
    expect(
      scenesFor([
        { type: "playerDied", player: "p1", cause: "hunter" },
        { type: "playerDied", player: "p3", cause: "grief" },
      ]),
    ).toEqual([
      {
        kind: "deaths",
        deaths: [
          { player: "p1", cause: "hunter" },
          { player: "p3", cause: "grief" },
        ],
      },
    ]);
    expect(scenesFor([{ type: "voteCast", voter: "p1" }])).toEqual([]);
  });
});

describe("SceneQueue", () => {
  it("plays scenes in order and can be skipped or cleared", () => {
    const queue = new SceneQueue();
    let changes = 0;
    queue.subscribe(() => changes++);
    queue.push([{ kind: "dawn", deaths: [] }]);
    queue.push([{ kind: "deaths", deaths: [] }]);
    queue.push([]);
    expect(queue.current()?.kind).toBe("dawn");
    queue.next();
    expect(queue.current()?.kind).toBe("deaths");
    queue.clear();
    expect(queue.current()).toBeNull();
    expect(changes).toBe(4);
  });
});
