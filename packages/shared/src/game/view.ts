import type { ChatAccess } from "../chat.js";
import type { GameAction, GameActionType, PlayerId } from "./actions.js";
import type { RevealOnDeath } from "./config.js";
import type { GameResult, Phase } from "./phases.js";
import type { RoleId, Side } from "./roles.js";

/** What one player is allowed to see of another. Unknown fields are simply absent. */
export interface PublicPlayer {
  id: PlayerId;
  name: string;
  seat: number;
  alive: boolean;
  isSheriff: boolean;
  role?: RoleId;
  side?: Side;
  /** Visible to wolves (pack members) and to dead/spectators when allowed. */
  isWolfAlly?: boolean;
  /** Visible to the Piper and to charmed players. */
  charmed?: boolean;
  /** Visible to the lovers and Cupid. */
  isLover?: boolean;
}

export interface PendingAction {
  /** Actions the viewer may send right now. */
  types: GameActionType[];
  /** Valid targets for targeted actions. */
  targets: PlayerId[];
}

export interface SelfView {
  id: PlayerId;
  role: RoleId;
  side: Side;
  alive: boolean;
  infected: boolean;
  charmed: boolean;
  lover: PlayerId | null;
  sisters: PlayerId[];
  wildChildModel: PlayerId | null;
  wolfHoundSide: Side | null;
  witchPotions: { heal: boolean; poison: boolean } | null;
  foxActive: boolean | null;
  /** Last player the Salvador protected (cannot be protected again tonight); Salvador only. */
  salvadorLast: PlayerId | null;
  seerResults: { target: PlayerId; role: RoleId }[];
  /** What you have chosen so far in the current phase (`null`: nothing yet, or you passed). */
  choice: GameAction | null;
  foxResults: { target: PlayerId; wolfNearby: boolean }[];
}

/** The only representation of the game that ever leaves the server (see `projectFor`). */
export interface PlayerView {
  day: number;
  phase: Phase;
  revealOnDeath: RevealOnDeath;
  you: SelfView;
  players: PublicPlayer[];
  pending: PendingAction | null;
  /** Public day votes of the current vote step. */
  votes: Record<PlayerId, PlayerId | null>;
  /** Wolf votes, only for pack members during the wolves step. */
  wolfVotes: Record<PlayerId, PlayerId> | null;
  /** Tonight's wolf victims, only for the Witch during her step. */
  nightVictims: PlayerId[] | null;
  result: GameResult | null;
  /** Chat channels the viewer may write to / read right now. */
  chat: ChatAccess;
}
