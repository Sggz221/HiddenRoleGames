import { randomUUID } from "node:crypto";
import { MAX_PLAYERS, type PlayerId, type RoomMember } from "@aullidos/shared";
import { AttemptLimiter, type AttemptLimiterOptions } from "./attempt-limiter.js";
import { generateRoomCode, type RandomInt } from "./code.js";
import { Room } from "./room.js";

export type RoomError =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "NAME_TAKEN"
  | "TOO_MANY_ATTEMPTS"
  | "GAME_IN_PROGRESS";

export type JoinResult =
  | { ok: true; room: Room; member: RoomMember }
  | { ok: false; error: RoomError };

export interface RoomManagerOptions {
  maxPlayersPerRoom?: number;
  /** Failed joins (unknown code) tolerated per client key inside the window. */
  joinAttempts?: AttemptLimiterOptions;
  /** Rooms with no activity for this long are removed by `sweep`. */
  idleTtlMs?: number;
  now?: () => number;
  randomInt?: RandomInt;
  newPlayerId?: () => PlayerId;
}

const MAX_CODE_RETRIES = 20;

/**
 * Pre-game rooms of this process. Rooms live in memory (a lobby is cheap to recreate);
 * running games are persisted by `GameRegistry`.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly limiter: AttemptLimiter;
  private readonly maxPlayers: number;
  private readonly idleTtlMs: number;
  private readonly now: () => number;
  private readonly randomInt: RandomInt | undefined;
  private readonly newPlayerId: () => PlayerId;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxPlayers = options.maxPlayersPerRoom ?? MAX_PLAYERS;
    this.idleTtlMs = options.idleTtlMs ?? 2 * 60 * 60 * 1000;
    this.randomInt = options.randomInt;
    this.newPlayerId = options.newPlayerId ?? randomUUID;
    this.limiter = new AttemptLimiter(
      options.joinAttempts ?? { maxFailures: 10, windowMs: 60_000 },
      this.now,
    );
  }

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** Creates a room with the creator as host. */
  create(name: string): { room: Room; member: RoomMember } {
    const room = new Room(this.uniqueCode(), this.maxPlayers, this.now());
    const member = { id: this.newPlayerId(), name };
    room.add(member, this.now());
    this.rooms.set(room.code, room);
    return { room, member };
  }

  /** `clientKey` identifies the caller (IP) for the failed-attempt limit. */
  join(code: string, name: string, clientKey: string): JoinResult {
    if (this.limiter.isBlocked(clientKey)) return { ok: false, error: "TOO_MANY_ATTEMPTS" };
    const room = this.rooms.get(code);
    if (!room) {
      this.limiter.recordFailure(clientKey);
      return { ok: false, error: "ROOM_NOT_FOUND" };
    }
    if (room.gameId) return { ok: false, error: "GAME_IN_PROGRESS" };
    const member = { id: this.newPlayerId(), name };
    const added = room.add(member, this.now());
    if (!added.ok)
      return { ok: false, error: added.reason === "FULL" ? "ROOM_FULL" : "NAME_TAKEN" };
    return { ok: true, room, member };
  }

  /** Updates a member's presence. Returns the room when something changed. */
  setConnected(code: string, playerId: PlayerId, connected: boolean): Room | null {
    const room = this.rooms.get(code);
    return room?.setConnected(playerId, connected) ? room : null;
  }

  /** Removes a member. Returns the room, or `null` if it was destroyed (last member left). */
  leave(code: string, playerId: PlayerId): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.remove(playerId, this.now());
    if (room.isEmpty) {
      this.rooms.delete(code);
      return null;
    }
    return room;
  }

  /** Marks the room playing `gameId` as back in the lobby. Returns it, if it still exists. */
  endGame(gameId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.gameId !== gameId) continue;
      room.gameId = null;
      room.lastActivity = this.now();
      return room;
    }
    return null;
  }

  /** Removes lobbies nobody has touched for `idleTtlMs` (never one in a game); returns their codes. */
  sweep(): string[] {
    const cutoff = this.now() - this.idleTtlMs;
    const removed = [...this.rooms.values()].filter(
      (room) => room.gameId === null && room.lastActivity < cutoff,
    );
    for (const room of removed) this.rooms.delete(room.code);
    this.limiter.prune();
    return removed.map((room) => room.code);
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = generateRoomCode(this.randomInt);
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Could not generate a unique room code");
  }
}
