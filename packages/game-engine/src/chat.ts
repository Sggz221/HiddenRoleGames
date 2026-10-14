import {
  CHAT_CHANNELS,
  type ChatAccess,
  type ChatChannel,
  type PlayerId,
} from "@howlsinthedark/shared";
import { findPlayer, type GameState, loverOf } from "./state.js";

/**
 * Chat channels a player may write to and read from right now. Single source for both the
 * server's checks on `chat:send` and the `chat` field of the player's view.
 */
export function chatAccessFor(state: GameState, playerId: PlayerId): ChatAccess {
  const player = findPlayer(state, playerId);
  if (!player) return { write: [], read: [] };
  // After the end every secret is public: everyone reads everything and talks in general.
  if (state.phase.kind === "ended") return { write: ["general"], read: [...CHAT_CHANNELS] };

  const write = new Set<ChatChannel>();
  const read = new Set<ChatChannel>(["general"]);
  const { phase } = state;

  if (player.alive) {
    // Reactions (Hunter, Sheriff) follow a dawn or a vote, so they are public daytime moments.
    if (phase.kind === "day" || phase.kind === "reaction") write.add("general");
    if (player.side === "wolves") {
      read.add("wolves");
      if (phase.kind === "night") write.add("wolves");
    }
    if (loverOf(state, player.id)) {
      read.add("lovers");
      write.add("lovers");
    }
  } else {
    read.add("dead");
    write.add("dead");
    if (state.config.deadSeeEverything) {
      read.add("wolves");
      read.add("lovers");
    }
  }

  const ordered = (set: Set<ChatChannel>) => CHAT_CHANNELS.filter((channel) => set.has(channel));
  return { write: ordered(write), read: ordered(read) };
}

/** Who receives a line posted in `channel`. */
export function chatRecipients(state: GameState, channel: ChatChannel): PlayerId[] {
  return state.players
    .filter((player) => chatAccessFor(state, player.id).read.includes(channel))
    .map((player) => player.id);
}
