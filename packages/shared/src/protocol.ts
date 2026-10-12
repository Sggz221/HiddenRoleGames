import type { GameEventPayload } from "./game/events.js";
import type { PlayerView } from "./game/view.js";

export const ERROR_CODES = [
  "INVALID_PAYLOAD",
  "NOT_IN_GAME",
  "NOT_ALLOWED",
  "INVALID_TARGET",
  "DUPLICATE_TARGET",
  "POTION_USED",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type AckResponse = { ok: true } | { ok: false; code: ErrorCode; message: string };
export type Ack = (response: AckResponse) => void;

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
  error: (error: { code: ErrorCode; message: string }) => void;
}

/** Socket.IO events the client emits. Payloads are `unknown` until validated with Zod. */
export interface ClientToServerEvents {
  "game:action": (action: unknown, ack: Ack) => void;
  /** Asks for the current view again (e.g. after a reconnection). */
  "game:sync": (ack: Ack) => void;
}
