import type { Server as HttpServer } from "node:http";
import {
  type AckResponse,
  type ClientToServerEvents,
  gameActionSchema,
  type ServerToClientEvents,
} from "@aullidos/shared";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import { Server, type Socket } from "socket.io";
import type { GameRegistry } from "../game/registry.js";
import type { GamePublisher, Logger } from "../game/session.js";
import type { RoomManager } from "../rooms/manager.js";
import { registerRoomHandlers } from "./rooms.js";

/** Identity attached to a socket once it joins a room (and later a game). */
export interface SocketData {
  playerId?: string;
  roomCode?: string;
  gameId?: string;
}

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Each player has a private Socket.IO room, so every tab/device of theirs gets their projection. */
export const playerRoom = (gameId: string, playerId: string) => `game:${gameId}:player:${playerId}`;

export interface RealtimeDeps {
  registry: GameRegistry;
  rooms: RoomManager;
  log: Logger;
  /** When given, uses the Redis adapter so several instances can share rooms. */
  redis?: Redis;
}

export function createRealtime(httpServer: HttpServer, deps: RealtimeDeps) {
  const io: IoServer = new Server(httpServer, {
    path: "/socket.io",
    serveClient: false,
    // Same-origin in production (web is served by this server); Vite proxies in dev.
    cors: { origin: false },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16 * 1024,
  });

  const adapterClients = deps.redis ? [deps.redis.duplicate(), deps.redis.duplicate()] : [];
  const [pub, sub] = adapterClients;
  if (pub && sub) io.adapter(createAdapter(pub, sub));

  io.on("connection", (socket) => {
    registerGameHandlers(socket, deps);
    registerRoomHandlers(socket, io, deps.rooms);
  });

  return {
    io,
    async close() {
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.all(adapterClients.map((client) => client.quit().catch(() => undefined)));
    },
  };
}

export function socketPublisher(io: IoServer): GamePublisher {
  return {
    sendEvents: (gameId, playerId, events) =>
      io.to(playerRoom(gameId, playerId)).emit("game:events", events),
    sendView: (gameId, playerId, message) =>
      io.to(playerRoom(gameId, playerId)).emit("game:view", message),
  };
}

const reply = (ack: unknown, response: AckResponse) => {
  if (typeof ack === "function") ack(response);
};

function registerGameHandlers(socket: IoSocket, { registry, log }: RealtimeDeps): void {
  const sessionFor = () => {
    const { gameId, playerId } = socket.data;
    const session = gameId ? registry.get(gameId) : undefined;
    return session && playerId && session.hasPlayer(playerId) ? { session, playerId } : null;
  };

  socket.on("game:action", async (payload, ack) => {
    const parsed = gameActionSchema.safeParse(payload);
    if (!parsed.success) {
      reply(ack, { ok: false, code: "INVALID_PAYLOAD", message: "Malformed action" });
      return;
    }
    const target = sessionFor();
    if (!target) {
      reply(ack, { ok: false, code: "NOT_IN_GAME", message: "Join a game first" });
      return;
    }
    try {
      reply(ack, await target.session.handleAction(target.playerId, parsed.data));
    } catch (err) {
      log.error({ err, gameId: target.session.id }, "action failed");
      reply(ack, { ok: false, code: "INTERNAL", message: "Internal error" });
    }
  });

  socket.on("game:sync", (ack) => {
    const target = sessionFor();
    if (!target) {
      reply(ack, { ok: false, code: "NOT_IN_GAME", message: "Join a game first" });
      return;
    }
    socket.emit("game:view", target.session.viewFor(target.playerId));
    reply(ack, { ok: true });
  });
}
