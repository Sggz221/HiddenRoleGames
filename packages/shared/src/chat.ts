import { z } from "zod";
import type { PlayerId } from "./game/actions.js";

/**
 * - `general`: everyone reads; the living write during the day (and everyone in the lobby
 *   or once the game is over).
 * - `wolves`: the living pack, at night. The Little Girl reads it anonymously.
 * - `dead`: the dead, any time.
 * - `lovers`: the two living lovers, any time.
 *
 * Who may write or read is decided by the server (see `chatAccessFor` in the engine).
 */
export const CHAT_CHANNELS = ["general", "wolves", "dead", "lovers"] as const;
export const chatChannelSchema = z.enum(CHAT_CHANNELS);
export type ChatChannel = z.infer<typeof chatChannelSchema>;

export const CHAT_MESSAGE_MAX_LENGTH = 300;

/** Control characters and bidi overrides (used to spoof names and text direction). */
const FORBIDDEN_TEXT = /[\p{Cc}‪-‮⁦-⁩]/u;

export const chatSendSchema = z.object({
  channel: chatChannelSchema,
  text: z
    .string()
    .trim()
    .min(1)
    .max(CHAT_MESSAGE_MAX_LENGTH)
    .refine((text) => !FORBIDDEN_TEXT.test(text), "Control characters are not allowed"),
});
export type ChatSend = z.infer<typeof chatSendSchema>;

/** Channels the viewer may currently write to and read from. Part of `PlayerView`. */
export interface ChatAccess {
  write: ChatChannel[];
  read: ChatChannel[];
}

/** A chat line as delivered to one receiver. */
export interface ChatMessage {
  /** Unique per server process; lets clients drop duplicates (several tabs, resends). */
  id: string;
  channel: ChatChannel;
  /** `null` when the receiver may not know the author (the Little Girl spying on the wolves). */
  from: PlayerId | null;
  name: string | null;
  text: string;
  /** Server clock (epoch ms). */
  sentAt: number;
}
