import { z } from "zod";
import type { ErrorCode } from "./protocol.js";
import type { RoomStateMessage } from "./room.js";

/** `sessionToken` as issued by `room:create` / `room:join` (base64url, 32 random bytes). */
export const sessionResumeSchema = z.object({ token: z.string().min(20).max(128) });
export type SessionResume = z.infer<typeof sessionResumeSchema>;

/**
 * Reply to `session:resume`. When the player is in a running game, the server also sends
 * the current `game:view` right after the ack.
 */
export type SessionResumeAckResponse =
  | { ok: true; playerId: string; room: RoomStateMessage; gameId: string | null }
  | { ok: false; code: ErrorCode; message: string };
export type SessionResumeAck = (response: SessionResumeAckResponse) => void;
