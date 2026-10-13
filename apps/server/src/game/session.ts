import { randomUUID } from "node:crypto";
import {
  advancePhase,
  applyAction,
  canAdvanceEarly,
  chatAccessFor,
  chatRecipients,
  createGame,
  eventsFor,
  type GameState,
  type NewPlayer,
  phaseDurationSeconds,
  projectFor,
} from "@howlsinthedark/game-engine";
import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  GameAction,
  GameConfig,
  GameEvent,
  GameEventPayload,
  GameViewMessage,
} from "@howlsinthedark/shared";
import type { GameHistory } from "../persistence/game-history.js";
import type { GameSnapshot, GameStore } from "./store.js";

/** Delivers per-player messages (Socket.IO in production, an array in tests). */
export interface GamePublisher {
  sendEvents(gameId: string, playerId: string, events: GameEventPayload[]): void;
  sendView(gameId: string, playerId: string, message: GameViewMessage): void;
  sendChat(gameId: string, playerId: string, message: ChatMessage): void;
}

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface SessionDeps {
  store: GameStore;
  history: GameHistory;
  publisher: GamePublisher;
  log: Logger;
  clock?: Clock;
  onEnded?: (gameId: string) => void;
}

const stripAudience = ({ audience: _audience, ...event }: GameEvent): GameEventPayload => event;

/**
 * Runs one live game: serializes actions through a queue, drives phase timers from
 * server timestamps, persists a snapshot after every change and publishes per-player
 * projections. The only place where the engine meets the network.
 */
export class GameSession {
  private queue: Promise<unknown> = Promise.resolve();
  private timer: unknown = null;
  private disposed = false;
  private readonly clock: Clock;

  private constructor(
    private snapshot: GameSnapshot,
    private readonly deps: SessionDeps,
  ) {
    this.clock = deps.clock ?? systemClock;
  }

  get id(): string {
    return this.snapshot.id;
  }

  get state(): GameState {
    return this.snapshot.state;
  }

  get phaseEndsAt(): number | null {
    return this.snapshot.phaseEndsAt;
  }

  static async start(
    id: string,
    config: GameConfig,
    players: NewPlayer[],
    seed: number,
    deps: SessionDeps,
  ): Promise<GameSession> {
    const { state, events } = createGame(config, players, seed);
    const clock = deps.clock ?? systemClock;
    const now = clock.now();
    const session = new GameSession(
      { id, state, startedAt: now, phaseEndsAt: now + phaseDurationSeconds(state) * 1000 },
      deps,
    );
    await session.commit(events);
    deps.log.info({ gameId: id, players: players.length }, "game started");
    return session;
  }

  /** Resumes a stored game (e.g. after a deploy). Overdue phases advance immediately. */
  static async restore(id: string, deps: SessionDeps): Promise<GameSession | null> {
    const snapshot = await deps.store.load(id);
    if (!snapshot) return null;
    const session = new GameSession(snapshot, deps);
    session.schedule();
    deps.log.info({ gameId: id, phase: snapshot.state.phase }, "game restored");
    return session;
  }

  /** Validates and records a player's intent. Resolves once processed, in arrival order. */
  handleAction(playerId: string, action: GameAction): Promise<AckResponse> {
    return this.enqueue(async (): Promise<AckResponse> => {
      const result = applyAction(this.snapshot.state, playerId, action);
      if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
      this.snapshot.state = result.state;
      if (canAdvanceEarly(this.snapshot.state)) {
        await this.commit(result.events, false);
        await this.advance();
      } else {
        await this.commit(result.events);
      }
      return { ok: true };
    });
  }

  /**
   * Posts a chat line if the engine lets `playerId` write in `channel` right now and delivers
   * it to the channel's readers (anonymously where the rules say so). Chat never changes the
   * game state, so it does not go through the action queue.
   */
  chat(playerId: string, channel: ChatChannel, text: string): AckResponse {
    const { state } = this.snapshot;
    const author = state.players.find((player) => player.id === playerId);
    if (!author || !chatAccessFor(state, playerId).write.includes(channel)) {
      return { ok: false, code: "NOT_ALLOWED", message: "You cannot write in that channel now" };
    }
    const line = { id: randomUUID(), channel, text, sentAt: this.clock.now() };
    for (const { id, anonymous } of chatRecipients(state, channel)) {
      this.deps.publisher.sendChat(this.id, id, {
        ...line,
        from: anonymous ? null : author.id,
        name: anonymous ? null : author.name,
      });
    }
    return { ok: true };
  }

  /** Current message for one player (reconnection / sync). */
  viewFor(playerId: string): GameViewMessage {
    return {
      view: projectFor(this.snapshot.state, playerId),
      phaseEndsAt: this.snapshot.phaseEndsAt,
      serverNow: this.clock.now(),
    };
  }

  hasPlayer(playerId: string): boolean {
    return this.snapshot.state.players.some((player) => player.id === playerId);
  }

  /** Resolves once every queued action and phase change has been processed (tests, shutdown). */
  async whenIdle(): Promise<void> {
    await this.queue;
  }

  /** Stops timers; the snapshot stays in the store so another process can resume it. */
  dispose(): Promise<unknown> {
    this.disposed = true;
    this.clearTimer();
    return this.queue;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch((error: unknown) => {
      this.deps.log.error({ gameId: this.id, err: error }, "game task failed");
    });
    return run;
  }

  private async advance(): Promise<void> {
    if (this.snapshot.state.phase.kind === "ended") return;
    const { state, events } = advancePhase(this.snapshot.state);
    this.snapshot.state = state;
    this.snapshot.phaseEndsAt =
      state.phase.kind === "ended" ? null : this.clock.now() + phaseDurationSeconds(state) * 1000;
    await this.commit(events);
    if (state.phase.kind === "ended") await this.finish();
  }

  /** Persists, publishes and (re)schedules the phase timer. */
  private async commit(events: GameEvent[], publishView = true): Promise<void> {
    await this.deps.store.save(this.snapshot);
    this.publish(events, publishView);
    this.schedule();
  }

  private publish(events: GameEvent[], publishView: boolean): void {
    const { state } = this.snapshot;
    for (const player of state.players) {
      const visible = eventsFor(state, player.id, events).map(stripAudience);
      if (visible.length) this.deps.publisher.sendEvents(this.id, player.id, visible);
      if (publishView) this.deps.publisher.sendView(this.id, player.id, this.viewFor(player.id));
    }
  }

  private schedule(): void {
    this.clearTimer();
    const endsAt = this.snapshot.phaseEndsAt;
    if (this.disposed || endsAt === null) return;
    const delay = Math.max(0, endsAt - this.clock.now());
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      void this.enqueue(() => this.advance());
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private async finish(): Promise<void> {
    const { id, state, startedAt } = this.snapshot;
    this.deps.log.info({ gameId: id, result: state.result }, "game ended");
    try {
      await this.deps.history.record({ id, state, startedAt: new Date(startedAt) });
      await this.deps.store.delete(id);
    } catch (error) {
      // Keep the snapshot so the result can be recovered later.
      this.deps.log.error({ gameId: id, err: error }, "failed to record finished game");
    }
    this.deps.onEnded?.(id);
  }
}
