import { randomUUID } from "node:crypto";
import { type Ack, type AckResponse, chatSendSchema } from "@aullidos/shared";
import type { GameRegistry } from "../game/registry.js";
import type { RoomManager } from "../rooms/manager.js";
import type { IoServer, IoSocket } from "./io.js";
import { TokenBucket, type TokenBucketOptions } from "./rate-limiter.js";
import { roomChannel } from "./rooms.js";

/** Per socket: a burst of 5 lines, then one every 2 seconds. */
export const CHAT_RATE_LIMIT: TokenBucketOptions = { capacity: 5, refillPerSecond: 0.5 };

interface Deps {
  io: IoServer;
  registry: GameRegistry;
  rooms: RoomManager;
  now: () => number;
  rateLimit?: TokenBucketOptions;
}

const reply = (ack: unknown, response: AckResponse) => {
  if (typeof ack === "function") (ack as Ack)(response);
};

/**
 * `chat:send`. In a running game the engine decides channel membership (`GameSession.chat`);
 * in the lobby (before the start or after the end) there is only `general`.
 */
export function registerChatHandlers(socket: IoSocket, deps: Deps): void {
  const bucket = new TokenBucket(deps.rateLimit ?? CHAT_RATE_LIMIT, deps.now);

  socket.on("chat:send", (payload, ack) => {
    const parsed = chatSendSchema.safeParse(payload);
    if (!parsed.success) {
      return reply(ack, { ok: false, code: "INVALID_PAYLOAD", message: "Malformed message" });
    }
    const { roomCode, playerId, gameId } = socket.data;
    const room = roomCode ? deps.rooms.get(roomCode) : undefined;
    if (!roomCode || !playerId || !room?.has(playerId)) {
      return reply(ack, { ok: false, code: "NOT_IN_ROOM", message: "Join a room first" });
    }
    if (!bucket.take()) {
      return reply(ack, { ok: false, code: "RATE_LIMITED", message: "Slow down" });
    }

    const { channel, text } = parsed.data;
    const game = gameId ? deps.registry.get(gameId) : undefined;
    if (game?.hasPlayer(playerId)) return reply(ack, game.chat(playerId, channel, text));

    if (channel !== "general") {
      return reply(ack, { ok: false, code: "NOT_ALLOWED", message: "Only general in the lobby" });
    }
    const name = room.state().players.find((player) => player.id === playerId)?.name ?? null;
    deps.io.to(roomChannel(roomCode)).emit("chat:message", {
      id: randomUUID(),
      channel,
      from: playerId,
      name,
      text,
      sentAt: deps.now(),
    });
    reply(ack, { ok: true });
  });
}
