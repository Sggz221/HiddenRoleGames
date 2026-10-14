import {
  type PlayerId,
  type SessionResumeAckResponse,
  sessionResumeSchema,
} from "@howlsinthedark/shared";
import type { GameRegistry } from "../game/registry.js";
import type { RoomManager } from "../rooms/manager.js";
import type { SessionManager } from "../sessions/session-manager.js";
import { type IoServer, type IoSocket, playerRoom } from "./io.js";
import { roomChannel } from "./rooms.js";

interface Deps {
  io: IoServer;
  rooms: RoomManager;
  sessions: SessionManager;
  registry: GameRegistry;
}

const fail = (code: "INVALID_PAYLOAD" | "ALREADY_IN_ROOM" | "SESSION_NOT_FOUND", message: string) =>
  ({ ok: false, code, message }) satisfies SessionResumeAckResponse;

const broadcastRoom = ({ io, rooms }: Deps, code: string, except?: IoSocket) => {
  const room = rooms.get(code);
  if (!room || room.isEmpty) return;
  (except ? except.to(roomChannel(code)) : io.to(roomChannel(code))).emit(
    "room:state",
    room.state(),
  );
};

/** Puts a socket into the Socket.IO rooms a seated player listens to. */
function enter(socket: IoSocket, roomCode: string, playerId: PlayerId, gameId: string | null) {
  socket.data.playerId = playerId;
  socket.data.roomCode = roomCode;
  void socket.join(roomChannel(roomCode));
  if (gameId) {
    socket.data.gameId = gameId;
    void socket.join(playerRoom(gameId, playerId));
  }
}

/** `session:resume` and presence tracking (disconnect → grace period → give up the seat). */
export function registerSessionHandlers(socket: IoSocket, deps: Deps): void {
  const { rooms, sessions, registry } = deps;

  socket.on("session:resume", (payload, ack) => {
    const respond = (response: SessionResumeAckResponse) => {
      if (typeof ack === "function") ack(response);
    };
    const parsed = sessionResumeSchema.safeParse(payload);
    if (!parsed.success) return respond(fail("INVALID_PAYLOAD", "Malformed session token"));
    if (socket.data.playerId) return respond(fail("ALREADY_IN_ROOM", "This connection is seated"));

    const record = sessions.resolve(parsed.data.token);
    const room = record && rooms.get(record.roomCode);
    if (!record || !room?.has(record.playerId)) {
      if (record) sessions.revoke(record.playerId);
      return respond(fail("SESSION_NOT_FOUND", "That session has expired"));
    }

    // If the game ended meanwhile there is nothing to resume there: back to the lobby only.
    const game = record.gameId ? registry.get(record.gameId) : undefined;
    if (record.gameId && !game) record.gameId = null;

    enter(socket, record.roomCode, record.playerId, game ? record.gameId : null);
    sessions.connect(record.playerId);
    rooms.setConnected(record.roomCode, record.playerId, true);

    respond({
      ok: true,
      playerId: record.playerId,
      room: room.state(),
      gameId: game ? record.gameId : null,
    });
    broadcastRoom(deps, record.roomCode, socket);
    if (game) socket.emit("game:view", game.viewFor(record.playerId));
  });

  socket.on("disconnect", () => {
    const { playerId, roomCode } = socket.data;
    // `playerId` is cleared on an explicit leave, so only unexpected drops get here.
    if (!playerId || !roomCode) return;
    if (!sessions.disconnect(playerId)) return;
    if (rooms.setConnected(roomCode, playerId, false)) broadcastRoom(deps, roomCode);
  });
}

/** When the grace period ends in a lobby the seat is released, as if the player had left. */
export function releaseExpiredSeats(deps: Deps): () => void {
  const { rooms, sessions } = deps;
  return sessions.onGraceExpired((record) => {
    sessions.revoke(record.playerId);
    const room = rooms.leave(record.roomCode, record.playerId);
    if (room) broadcastRoom(deps, record.roomCode);
  });
}

/**
 * Called when a room's game starts (`room:start`): seats stop expiring and every connected
 * member joins their private game channel.
 */
export function attachRoomToGame(deps: Deps, roomCode: string, gameId: string): void {
  const bound = new Set(deps.sessions.bindGame(roomCode, gameId));
  for (const socket of deps.io.sockets.sockets.values()) {
    const { playerId } = socket.data;
    if (socket.data.roomCode !== roomCode || !playerId || !bound.has(playerId)) continue;
    socket.data.gameId = gameId;
    void socket.join(playerRoom(gameId, playerId));
  }
}
