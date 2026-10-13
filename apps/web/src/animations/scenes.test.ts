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

  it("day deaths (vote and grief) are one scene; nothing else stops the screen", () => {
    expect(
      scenesFor([
        { type: "voteResult", eliminated: "p1", tied: [] },
        { type: "playerDied", player: "p1", cause: "vote" },
        { type: "playerDied", player: "p3", cause: "grief" },
      ]),
    ).toEqual([
      {
        kind: "deaths",
        deaths: [
          { player: "p1", cause: "vote" },
          { player: "p3", cause: "grief" },
        ],
      },
    ]);
    expect(scenesFor([{ type: "voteCast", voter: "p1", target: "p2" }])).toEqual([]);
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
