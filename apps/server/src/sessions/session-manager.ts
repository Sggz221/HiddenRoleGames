import { createHash, randomBytes } from "node:crypto";
import type { PlayerId } from "@aullidos/shared";
import { type Clock, systemClock } from "../game/session.js";

export interface SessionRecord {
  playerId: PlayerId;
  roomCode: string;
  /** Set once the room's game starts; from then on the seat never expires (see `disconnect`). */
  gameId: string | null;
  /** Live sockets of this player (several tabs/devices are allowed). */
  connections: number;
}

export interface SessionManagerOptions {
  /** How long a lobby seat is held after the last connection drops. */
  graceMs?: number;
  clock?: Clock;
}

type ExpiryListener = (record: SessionRecord) => void;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Player identity across connections. A `sessionToken` (random, kept by the client) lets a new
 * socket take over a seat after a disconnection. Only the token's hash is stored.
 *
 * Disconnection policy:
 * - In a **lobby** the seat is released when the grace period ends without a return.
 * - In a **game** the seat is kept: the engine already treats a missing action as "no action",
 *   so the game goes on and the player can come back at any time (grace does not apply).
 */
export class SessionManager {
  private readonly records = new Map<PlayerId, SessionRecord>();
  private readonly byToken = new Map<string, PlayerId>();
  private readonly tokens = new Map<PlayerId, string>();
  private readonly timers = new Map<PlayerId, unknown>();
  private readonly listeners = new Set<ExpiryListener>();
  private readonly graceMs: number;
  private readonly clock: Clock;

  constructor(options: SessionManagerOptions = {}) {
    this.graceMs = options.graceMs ?? 60_000;
    this.clock = options.clock ?? systemClock;
  }

  get size(): number {
    return this.records.size;
  }

  /** Called when a lobby seat is given up because the grace period ended. */
  onGraceExpired(listener: ExpiryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Creates a session for a freshly seated player (with its first connection). */
  issue(playerId: PlayerId, roomCode: string): string {
    const token = randomBytes(32).toString("base64url");
    this.records.set(playerId, { playerId, roomCode, gameId: null, connections: 1 });
    this.byToken.set(hashToken(token), playerId);
    this.tokens.set(playerId, hashToken(token));
    return token;
  }

  get(playerId: PlayerId): SessionRecord | undefined {
    return this.records.get(playerId);
  }

  resolve(token: string): SessionRecord | null {
    const playerId = this.byToken.get(hashToken(token));
    return (playerId && this.records.get(playerId)) || null;
  }

  /** A socket attached to the seat (resume). Cancels a pending grace countdown. */
  connect(playerId: PlayerId): void {
    const record = this.records.get(playerId);
    if (!record) return;
    record.connections += 1;
    this.cancelGrace(playerId);
  }

  /**
   * A socket detached. Returns `true` when the player has no connection left (offline).
   * In a lobby that starts the grace countdown.
   */
  disconnect(playerId: PlayerId): boolean {
    const record = this.records.get(playerId);
    if (!record) return false;
    record.connections = Math.max(0, record.connections - 1);
    if (record.connections > 0) return false;
    if (record.gameId === null) this.startGrace(record);
    return true;
  }

  /** Marks every session of a room as in-game, so their seats stop expiring. */
  bindGame(roomCode: string, gameId: string): PlayerId[] {
    const bound: PlayerId[] = [];
    for (const record of this.records.values()) {
      if (record.roomCode !== roomCode) continue;
      record.gameId = gameId;
      this.cancelGrace(record.playerId);
      bound.push(record.playerId);
    }
    return bound;
  }

  revoke(playerId: PlayerId): void {
    this.cancelGrace(playerId);
    const hash = this.tokens.get(playerId);
    if (hash) this.byToken.delete(hash);
    this.tokens.delete(playerId);
    this.records.delete(playerId);
  }

  revokeRoom(roomCode: string): void {
    for (const record of [...this.records.values()]) {
      if (record.roomCode === roomCode) this.revoke(record.playerId);
    }
  }

  /** Clears every pending timer (shutdown). */
  dispose(): void {
    for (const handle of this.timers.values()) this.clock.clearTimeout(handle);
    this.timers.clear();
  }

  private startGrace(record: SessionRecord): void {
    this.cancelGrace(record.playerId);
    const handle = this.clock.setTimeout(() => {
      this.timers.delete(record.playerId);
      // A return can race the timer: only expire seats that are still offline.
      if (this.records.get(record.playerId)?.connections !== 0) return;
      for (const listener of this.listeners) listener(record);
    }, this.graceMs);
    this.timers.set(record.playerId, handle);
  }

  private cancelGrace(playerId: PlayerId): void {
    const handle = this.timers.get(playerId);
    if (handle === undefined) return;
    this.clock.clearTimeout(handle);
    this.timers.delete(playerId);
  }
}
