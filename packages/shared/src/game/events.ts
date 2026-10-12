import type { PlayerId } from "./actions.js";
import type { GameResult, Phase } from "./phases.js";
import type { RoleId, Side } from "./roles.js";

/**
 * How a death is announced publicly. Night kills are deliberately merged into "night"
 * so nobody learns which power killed whom.
 */
export type PublicDeathCause = "night" | "vote" | "hunter" | "grief" | "rust";

/** Events describe what happened, for narration/animation. Each one is sent only to its audience. */
export type GameEventPayload =
  | { type: "gameStarted"; players: PlayerId[] }
  | { type: "roleAssigned"; role: RoleId }
  | { type: "phaseChanged"; phase: Phase; day: number }
  | { type: "playerDied"; player: PlayerId; cause: PublicDeathCause; role?: RoleId; side?: Side }
  | { type: "voteCast"; voter: PlayerId; target: PlayerId | null }
  | { type: "voteResult"; eliminated: PlayerId | null; tied: PlayerId[] }
  | { type: "runoffStarted"; candidates: PlayerId[] }
  | { type: "sheriffElected"; player: PlayerId | null }
  | { type: "sheriffChanged"; player: PlayerId | null }
  | { type: "wolfVoteCast"; voter: PlayerId; target: PlayerId }
  | { type: "wolvesChoseVictim"; victim: PlayerId | null }
  | { type: "loversLinked"; lovers: [PlayerId, PlayerId] }
  | { type: "seerResult"; target: PlayerId; role: RoleId }
  | { type: "wildChildModelChosen"; model: PlayerId }
  | { type: "wildChildTransformed" }
  | { type: "wolfHoundChose"; side: Side }
  | { type: "playerInfected"; player: PlayerId }
  | { type: "foxResult"; target: PlayerId; wolfNearby: boolean }
  | { type: "playersCharmed"; charmed: PlayerId[] }
  | { type: "bearGrowled" }
  | { type: "villagePowersLost" }
  | { type: "elderResisted" }
  | { type: "gameEnded"; result: GameResult; roles: Record<PlayerId, RoleId> };

export type Audience = { kind: "all" } | { kind: "players"; ids: PlayerId[] };

export type GameEvent = GameEventPayload & { audience: Audience };
