import {
  type Ack,
  type ErrorCode,
  type RoomAck,
  type RoomAckResponse,
  roomCreateSchema,
  roomJoinSchema,
} from "@aullidos/shared";
import type { RoomManager } from "../rooms/manager.js";
import type { SessionManager } from "../sessions/session-manager.js";
import { type IoServer, type IoSocket, playerRoom } from "./io.js";

export const roomChannel = (code: string) => `room:${code}`;

const reply = (ack: unknown, response: RoomAckResponse) => {
  if (typeof ack === "function") (ack as RoomAck)(response);
};

const fail = (ack: unknown, code: ErrorCode, message: string) =>
  reply(ack, { ok: false, code, message });

/**
 * Key for the failed-join limit. Behind Railway's proxy the socket address is the proxy's,
 * so use the right-most `X-Forwarded-For` entry: the one our own proxy appended (the
 * left-most ones are client-controlled and spoofable).
 */
export function clientKey(socket: IoSocket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const list = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)?.split(",") ?? [];
  const last = list[list.length - 1]?.trim();
  return last || socket.handshake.address;
}

/** Takes the socket out of its room, tells the others and drops the room if it is empty. */
export function leaveCurrentRoom(
  socket: IoSocket,
  io: IoServer,
  rooms: RoomManager,
  sessions: SessionManager,
): boolean {
  const { roomCode, playerId, gameId } = socket.data;
  if (!roomCode || !playerId) return false;
  delete socket.data.roomCode;
  delete socket.data.playerId;
  delete socket.data.gameId;
  void socket.leave(roomChannel(roomCode));
  // In a game the seat stays in the engine: missing actions count as "no action".
  if (gameId) void socket.leave(playerRoom(gameId, playerId));
  // Leaving on purpose gives the seat up at once: no grace period, the token stops working.
  sessions.revoke(playerId);
  const room = rooms.leave(roomCode, playerId);
  if (room) io.to(roomChannel(roomCode)).emit("room:state", room.state());
  return true;
}

export function registerRoomHandlers(
  socket: IoSocket,
  io: IoServer,
  rooms: RoomManager,
  sessions: SessionManager,
): void {
  socket.on("room:create", (payload, ack) => {
    const parsed = roomCreateSchema.safeParse(payload);
    if (!parsed.success) return fail(ack, "INVALID_PAYLOAD", "Malformed room request");
    if (socket.data.roomCode) return fail(ack, "ALREADY_IN_ROOM", "Leave your room first");

    const { room, member } = rooms.create(parsed.data.name);
    socket.data.roomCode = room.code;
    socket.data.playerId = member.id;
    void socket.join(roomChannel(room.code));
    const sessionToken = sessions.issue(member.id, room.code);
    reply(ack, { ok: true, playerId: member.id, sessionToken, room: room.state() });
  });

  socket.on("room:join", (payload, ack) => {
    const parsed = roomJoinSchema.safeParse(payload);
    if (!parsed.success) return fail(ack, "INVALID_PAYLOAD", "Malformed room request");
    if (socket.data.roomCode) return fail(ack, "ALREADY_IN_ROOM", "Leave your room first");

    const result = rooms.join(parsed.data.code, parsed.data.name, clientKey(socket));
    if (!result.ok) return fail(ack, result.error, MESSAGES[result.error]);

    const { room, member } = result;
    socket.data.roomCode = room.code;
    socket.data.playerId = member.id;
    void socket.join(roomChannel(room.code));
    const sessionToken = sessions.issue(member.id, room.code);
    reply(ack, { ok: true, playerId: member.id, sessionToken, room: room.state() });
    socket.to(roomChannel(room.code)).emit("room:state", room.state());
  });

  socket.on("room:leave", (ack: Ack) => {
    const left = leaveCurrentRoom(socket, io, rooms, sessions);
    if (typeof ack !== "function") return;
    ack(left ? { ok: true } : { ok: false, code: "NOT_IN_ROOM", message: "You are not in a room" });
  });
}

const MESSAGES = {
  ROOM_NOT_FOUND: "That room does not exist",
  ROOM_FULL: "The room is full",
  NAME_TAKEN: "That name is already taken in the room",
  TOO_MANY_ATTEMPTS: "Too many failed attempts, try again in a minute",
  GAME_IN_PROGRESS: "That room is in the middle of a game",
} as const;
