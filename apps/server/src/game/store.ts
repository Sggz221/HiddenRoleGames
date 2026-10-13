import type { GameState } from "@aullidos/game-engine";
import type { Redis } from "ioredis";

/** Everything needed to resume a live game after a restart or deploy. */
export interface GameSnapshot {
  id: string;
  state: GameState;
  phaseEndsAt: number | null;
  startedAt: number;
}

export interface GameStore {
  save(snapshot: GameSnapshot): Promise<void>;
  load(id: string): Promise<GameSnapshot | null>;
  delete(id: string): Promise<void>;
  /** Ids of every stored live game (used to resume games on boot). */
  list(): Promise<string[]>;
}

export class MemoryGameStore implements GameStore {
  private readonly games = new Map<string, string>();

  async save(snapshot: GameSnapshot): Promise<void> {
    this.games.set(snapshot.id, JSON.stringify(snapshot));
  }

  async load(id: string): Promise<GameSnapshot | null> {
    const raw = this.games.get(id);
    return raw ? (JSON.parse(raw) as GameSnapshot) : null;
  }

  async delete(id: string): Promise<void> {
    this.games.delete(id);
  }

  async list(): Promise<string[]> {
    return [...this.games.keys()];
  }
}

const PREFIX = "aullidos:game:";

export class RedisGameStore implements GameStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  async save(snapshot: GameSnapshot): Promise<void> {
    await this.redis.set(PREFIX + snapshot.id, JSON.stringify(snapshot), "EX", this.ttlSeconds);
  }

  async load(id: string): Promise<GameSnapshot | null> {
    const raw = await this.redis.get(PREFIX + id);
    return raw ? (JSON.parse(raw) as GameSnapshot) : null;
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(PREFIX + id);
  }

  async list(): Promise<string[]> {
    const ids: string[] = [];
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(cursor, "MATCH", `${PREFIX}*`, "COUNT", 100);
      cursor = next;
      ids.push(...keys.map((key) => key.slice(PREFIX.length)));
    } while (cursor !== "0");
    return ids;
  }
}
