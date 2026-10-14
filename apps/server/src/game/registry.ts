import { randomUUID } from "node:crypto";
import type { NewPlayer } from "@howlsinthedark/game-engine";
import type { GameConfig } from "@howlsinthedark/shared";
import { GameSession, type SessionDeps } from "./session.js";

/**
 * Live games handled by this process. `room:start` calls `start` when the host launches a
 * game; on boot `restoreAll` resumes games stored in Redis.
 */
export class GameRegistry {
  private readonly sessions = new Map<string, GameSession>();
  private readonly endedListeners = new Set<(gameId: string) => void>();

  constructor(private readonly deps: Omit<SessionDeps, "onEnded">) {}

  get size(): number {
    return this.sessions.size;
  }

  get(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  async start(
    config: GameConfig,
    players: NewPlayer[],
    seed: number,
    id: string = randomUUID(),
  ): Promise<GameSession> {
    const session = await GameSession.start(id, config, players, seed, this.sessionDeps());
    this.sessions.set(id, session);
    return session;
  }

  /** Called after a game ends (its final view and events have already been published). */
  onGameEnded(listener: (gameId: string) => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  async restoreAll(): Promise<number> {
    const ids = await this.deps.store.list();
    for (const id of ids) {
      if (this.sessions.has(id)) continue;
      const session = await GameSession.restore(id, this.sessionDeps());
      if (session) this.sessions.set(id, session);
    }
    return this.sessions.size;
  }

  async disposeAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.dispose()));
    this.sessions.clear();
  }

  private sessionDeps(): SessionDeps {
    return {
      ...this.deps,
      onEnded: (id) => {
        this.sessions.delete(id);
        for (const listener of this.endedListeners) listener(id);
      },
    };
  }
}
