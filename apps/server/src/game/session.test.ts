import { type GameEventPayload, type GameViewMessage, gameConfigSchema } from "@aullidos/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FinishedGame, GameHistory } from "../persistence/game-history.js";
import { GameRegistry } from "./registry.js";
import { type Clock, type GamePublisher, GameSession } from "./session.js";
import { MemoryGameStore } from "./store.js";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

const fakeClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

class RecordingPublisher implements GamePublisher {
  views = new Map<string, GameViewMessage>();
  events: { playerId: string; events: GameEventPayload[] }[] = [];
  sendEvents(_gameId: string, playerId: string, events: GameEventPayload[]) {
    this.events.push({ playerId, events });
  }
  sendView(_gameId: string, playerId: string, message: GameViewMessage) {
    this.views.set(playerId, message);
  }
}

class RecordingHistory implements GameHistory {
  games: FinishedGame[] = [];
  async record(game: FinishedGame) {
    this.games.push(game);
  }
}

const config = gameConfigSchema.parse({
  roles: ["werewolf", "seer", "villager", "villager", "villager"],
  sheriff: false,
  timers: { nightStepSeconds: 10, debateSeconds: 30, voteSeconds: 20 },
});
const players = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id.toUpperCase() }));

describe("GameSession", () => {
  let store: MemoryGameStore;
  let publisher: RecordingPublisher;
  let history: RecordingHistory;
  const deps = () => ({ store, publisher, history, log: silentLog, clock: fakeClock });

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    store = new MemoryGameStore();
    publisher = new RecordingPublisher();
    history = new RecordingHistory();
  });
  afterEach(() => vi.useRealTimers());

  it("publishes one projection per player and persists a snapshot", async () => {
    const session = await GameSession.start("g1", config, players, 1, deps());
    expect(publisher.views.size).toBe(5);
    for (const [playerId, message] of publisher.views) {
      expect(message.view.you.id).toBe(playerId);
      const othersRoles = message.view.players.filter((p) => p.id !== playerId && p.role);
      expect(othersRoles).toEqual([]);
      expect(message.phaseEndsAt).toBe(1_000_000 + 10_000);
    }
    expect(await store.load("g1")).toMatchObject({ id: "g1", phaseEndsAt: 1_010_000 });
    expect(JSON.stringify([...publisher.views.values()])).not.toContain('"rngState"');
    await session.dispose();
  });

  it("advances phases on the server timer", async () => {
    const session = await GameSession.start("g1", config, players, 1, deps());
    expect(session.state.phase).toEqual({ kind: "night", step: "seer" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(session.state.phase).toEqual({ kind: "night", step: "wolves" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(session.state.phase).toEqual({ kind: "day", step: "debate" });
    await session.dispose();
  });

  it("rejects invalid actions with the engine error code", async () => {
    const session = await GameSession.start("g1", config, players, 1, deps());
    const notSeer = session.state.players.find((p) => p.role !== "seer")!;
    await expect(
      session.handleAction(notSeer.id, { type: "seerInspect", target: "a" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    });
    await session.dispose();
  });

  it("ends the day early when everyone voted, and records the finished game", async () => {
    const session = await GameSession.start("g1", config, players, 1, deps());
    await vi.advanceTimersByTimeAsync(20_000 + 30_000); // night (2 steps) + debate
    expect(session.state.phase).toEqual({ kind: "day", step: "vote" });

    const wolf = session.state.players.find((p) => p.role === "werewolf")!;
    for (const player of session.state.players.filter((p) => p.alive)) {
      await session.handleAction(player.id, {
        type: "vote",
        target: player.id === wolf.id ? null : wolf.id,
      });
    }
    expect(session.state.phase).toEqual({ kind: "ended" });
    expect(history.games).toHaveLength(1);
    expect(history.games[0]?.state.result?.team).toBe("village");
    expect(await store.load("g1")).toBeNull();
    const ended = publisher.events.flatMap((e) => e.events).filter((e) => e.type === "gameEnded");
    expect(ended).toHaveLength(5);
  });

  it("resumes from the store after a restart and catches up overdue phases", async () => {
    const first = await GameSession.start("g1", config, players, 1, deps());
    await first.dispose(); // process dies during the seer step

    vi.setSystemTime(1_000_000 + 60_000); // way past the phase end
    const registry = new GameRegistry(deps());
    expect(await registry.restoreAll()).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.get("g1")?.state.phase).toEqual({ kind: "night", step: "wolves" });
    await registry.disposeAll();
  });
});
