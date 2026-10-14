import type { PlayerId } from "./actions.js";
import type { GameResult, Phase } from "./phases.js";
import type { RoleId, Side } from "./roles.js";

/**
 * How a death is announced publicly. Night kills are deliberately merged into "night"
 * so nobody learns which power killed whom.
 */
export type PublicDeathCause = "night" | "vote" | "hunter" | "grief" | "rust";

/**
 * Events describe what happened, for narration/animation. Each one is sent only to its audience.
 * Private events name who acted (`seer`, `fox`...): the dead and, at the end, everyone receive
 * them too, and the narrator must tell them apart from the player who acted.
 */
export type GameEventPayload =
  | { type: "gameStarted"; players: PlayerId[] }
  | { type: "roleAssigned"; role: RoleId }
  | { type: "phaseChanged"; phase: Phase; day: number }
  /** The night is over; the deaths it caused follow in the same batch. */
  | { type: "dawn"; day: number }
  | { type: "playerDied"; player: PlayerId; cause: PublicDeathCause; role?: RoleId; side?: Side }
  | { type: "voteCast"; voter: PlayerId; target: PlayerId | null }
  | { type: "voteResult"; eliminated: PlayerId | null; tied: PlayerId[] }
  | { type: "runoffStarted"; candidates: PlayerId[] }
  | { type: "sheriffElected"; player: PlayerId | null }
  | { type: "sheriffChanged"; player: PlayerId | null }
  | { type: "wolfVoteCast"; voter: PlayerId; target: PlayerId }
  | { type: "wolvesChoseVictim"; victim: PlayerId | null }
  | { type: "loversLinked"; lovers: [PlayerId, PlayerId] }
  | { type: "seerResult"; seer: PlayerId; target: PlayerId; role: RoleId }
  | { type: "wildChildModelChosen"; child: PlayerId; model: PlayerId }
  | { type: "wildChildTransformed"; child: PlayerId }
  | { type: "wolfHoundChose"; hound: PlayerId; side: Side }
  | { type: "playerInfected"; player: PlayerId }
  | { type: "foxResult"; fox: PlayerId; target: PlayerId; wolfNearby: boolean }
  | { type: "playersCharmed"; charmed: PlayerId[] }
  | { type: "bearGrowled" }
  | { type: "villagePowersLost" }
  | { type: "elderResisted"; elder: PlayerId }
  | { type: "gameEnded"; result: GameResult; roles: Record<PlayerId, RoleId> };

export type Audience = { kind: "all" } | { kind: "players"; ids: PlayerId[] };

export type GameEvent = GameEventPayload & { audience: Audience };
