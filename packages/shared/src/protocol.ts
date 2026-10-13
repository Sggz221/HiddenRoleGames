import type { GameEventPayload } from "./game/events.js";
import type { PlayerView } from "./game/view.js";
import type { RoomStateMessage } from "./room.js";
import type { SessionResumeAck } from "./session.js";

export const ERROR_CODES = [
  "INVALID_PAYLOAD",
  "NOT_IN_GAME",
  "NOT_ALLOWED",
  "INVALID_TARGET",
  "DUPLICATE_TARGET",
  "POTION_USED",
  "RATE_LIMITED",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "NAME_TAKEN",
  "ALREADY_IN_ROOM",
  "NOT_IN_ROOM",
  "TOO_MANY_ATTEMPTS",
  "SESSION_NOT_FOUND",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type AckResponse = { ok: true } | { ok: false; code: ErrorCode; message: string };
export type Ack = (response: AckResponse) => void;

/**
 * Reply to `room:create` / `room:join`: who you are in the room, its current state and the
 * `sessionToken` the client must keep (localStorage) to resume after a disconnection.
 */
export type RoomAckResponse =
  | { ok: true; playerId: string; sessionToken: string; room: RoomStateMessage }
  | { ok: false; code: ErrorCode; message: string };
export type RoomAck = (response: RoomAckResponse) => void;

export interface GameViewMessage {
  view: PlayerView;
  /** Epoch ms when the current phase ends (server clock), `null` once the game is over. */
  phaseEndsAt: number | null;
  /** Server clock when the message was sent, to correct client clock drift. */
  serverNow: number;
}

/** Socket.IO events the server emits. */
export interface ServerToClientEvents {
  "game:view": (message: GameViewMessage) => void;
  /** Ordered narration events for animations; already filtered for the receiver. */
  "game:events": (events: GameEventPayload[]) => void;
  /** Lobby changed (someone joined/left, host changed). Sent to every member of the room. */
  "room:state": (room: RoomStateMessage) => void;
  error: (error: { code: ErrorCode; message: string }) => void;
}

/** Socket.IO events the client emits. Payloads are `unknown` until validated with Zod. */
export interface ClientToServerEvents {
  "game:action": (action: unknown, ack: Ack) => void;
  /** Asks for the current view again (e.g. after a reconnection). */
  "game:sync": (ack: Ack) => void;
  "room:create": (payload: unknown, ack: RoomAck) => void;
  "room:join": (payload: unknown, ack: RoomAck) => void;
  "room:leave": (ack: Ack) => void;
  /** Reattaches a new connection to an existing seat using the `sessionToken`. */
  "session:resume": (payload: unknown, ack: SessionResumeAck) => void;
}
