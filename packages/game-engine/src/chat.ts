import {
  CHAT_CHANNELS,
  type ChatAccess,
  type ChatChannel,
  type PlayerId,
} from "@howlsinthedark/shared";
import { findPlayer, type GameState, hasPower, loverOf, type PlayerState } from "./state.js";

export interface ChatRecipient {
  id: PlayerId;
  /** The receiver must not learn who wrote the line (the Little Girl spying on the wolves). */
  anonymous: boolean;
}

/** The Little Girl peeks at the wolves' chat while she keeps her power (see docs/game-design.md). */
const spiesOnWolves = (state: GameState, player: PlayerState): boolean =>
  player.role === "little-girl" && player.side === "village" && hasPower(state, player);

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
    } else if (spiesOnWolves(state, player)) {
      read.add("wolves");
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

/** Who receives a line posted in `channel`, and whether the author is hidden from them. */
export function chatRecipients(state: GameState, channel: ChatChannel): ChatRecipient[] {
  return state.players.flatMap((player): ChatRecipient[] => {
    if (!chatAccessFor(state, player.id).read.includes(channel)) return [];
    const anonymous =
      channel === "wolves" &&
      player.alive &&
      player.side !== "wolves" &&
      state.phase.kind !== "ended";
    return [{ id: player.id, anonymous }];
  });
}
