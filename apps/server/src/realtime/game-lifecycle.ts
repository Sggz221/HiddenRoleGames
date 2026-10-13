import { randomInt, randomUUID } from "node:crypto";
import {
  type Ack,
  type AckResponse,
  type ErrorCode,
  gameConfigSchema,
  MIN_PLAYERS,
  recommendedDeck,
  roomStartSchema,
} from "@howlsinthedark/shared";
import type { GameRegistry } from "../game/registry.js";
import type { Logger } from "../game/session.js";
import type { RoomManager } from "../rooms/manager.js";
import type { SessionManager } from "../sessions/session-manager.js";
import { type IoServer, type IoSocket, playerRoom } from "./io.js";
import { roomChannel } from "./rooms.js";
import { attachRoomToGame } from "./sessions.js";

interface Deps {
  io: IoServer;
  rooms: RoomManager;
  sessions: SessionManager;
  registry: GameRegistry;
  log: Logger;
}

const reply = (ack: unknown, response: AckResponse) => {
  if (typeof ack === "function") (ack as Ack)(response);
};
const fail = (ack: unknown, code: ErrorCode, message: string) =>
  reply(ack, { ok: false, code, message });

const broadcastRoom = ({ io, rooms }: Deps, code: string) => {
  const room = rooms.get(code);
  if (room && !room.isEmpty) io.to(roomChannel(code)).emit("room:state", room.state());
};

/**
 * `room:start`: the host deals the cards to everyone seated (connected or within their grace
 * period). Seat order is join order; the engine shuffles the deck.
 */
export function registerStartHandler(socket: IoSocket, deps: Deps): void {
  socket.on("room:start", async (payload, ack) => {
    const parsed = roomStartSchema.safeParse(payload ?? {});
    if (!parsed.success) return fail(ack, "INVALID_PAYLOAD", "Malformed start request");

    const { roomCode, playerId } = socket.data;
    const room = roomCode ? deps.rooms.get(roomCode) : undefined;
    if (!roomCode || !playerId || !room?.has(playerId)) {
      return fail(ack, "NOT_IN_ROOM", "You are not in a room");
    }
    if (room.hostId !== playerId) return fail(ack, "NOT_ALLOWED", "Only the host can start");
    if (room.gameId) return fail(ack, "GAME_IN_PROGRESS", "The game has already started");

    const players = room.state().players.map(({ id, name }) => ({ id, name }));
    if (players.length < MIN_PLAYERS) {
      return fail(ack, "NOT_ENOUGH_PLAYERS", `At least ${MIN_PLAYERS} players are needed`);
    }
    const roles = parsed.data.roles ?? recommendedDeck(players.length);
    if (roles.length !== players.length) {
      return fail(ack, "INVALID_CONFIG", `The deck needs exactly ${players.length} cards`);
    }
    const config = gameConfigSchema.safeParse({ ...parsed.data, roles });
    if (!config.success) {
      return fail(ack, "INVALID_CONFIG", config.error.issues.map((i) => i.message).join("; "));
    }

    // Claim the room synchronously so a second `room:start` cannot race this one.
    const gameId = randomUUID();
    room.gameId = gameId;
    // Join the players' private channels before the game publishes its first views.
    attachRoomToGame(deps, roomCode, gameId);
    broadcastRoom(deps, roomCode);
    try {
      await deps.registry.start(config.data, players, randomInt(2 ** 31), gameId);
    } catch (err) {
      deps.log.error({ err, roomCode }, "could not start game");
      endRoomGame(deps, gameId);
      return fail(ack, "INTERNAL", "Could not start the game");
    }
    reply(ack, { ok: true });
  });
}

/** The game ended (or failed to start): the room goes back to the lobby for a rematch. */
export function endRoomGame(deps: Deps, gameId: string): void {
  deps.sessions.unbindGame(gameId);
  for (const socket of deps.io.sockets.sockets.values()) {
    const { playerId } = socket.data;
    if (socket.data.gameId !== gameId) continue;
    delete socket.data.gameId;
    if (playerId) void socket.leave(playerRoom(gameId, playerId));
  }
  const room = deps.rooms.endGame(gameId);
  if (room) broadcastRoom(deps, room.code);
}
