import type { PlayerId } from "./actions.js";
import type { PublicDeathCause } from "./events.js";
import { NIGHT_STEPS, type WinnerTeam } from "./phases.js";
import type { RoleId, Side } from "./roles.js";

/**
 * The game narrates itself: the engine turns each batch of events a player received into
 * predefined narration lines. A line is a text key plus the data to fill it in; the texts
 * live in the web i18n files under `narration.<key>`.
 */

const DEATH_CAUSES = [
  "night",
  "vote",
  "hunter",
  "grief",
  "rust",
] as const satisfies readonly PublicDeathCause[];

/** How much of the dead player's card is revealed (follows `config.revealOnDeath`). */
const DEATH_REVEALS = ["role", "side", "hidden"] as const;
export type DeathReveal = (typeof DEATH_REVEALS)[number];

const WINNER_TEAMS = [
  "village",
  "wolves",
  "lovers",
  "white-werewolf",
  "piper",
  "angel",
  "none",
] as const satisfies readonly WinnerTeam[];

/** Every narration text that exists. Tests check each one has a translation. */
export const NARRATION_KEYS = [
  "game.started",
  "game.yourRole",
  "night.falls",
  ...NIGHT_STEPS.map((step) => `night.wakes.${step}` as const),
  "dawn.nobody",
  "dawn.one",
  "dawn.many",
  ...DEATH_CAUSES.flatMap((cause) =>
    DEATH_REVEALS.map((reveal) => `death.${cause}.${reveal}` as const),
  ),
  "day.sheriffElection",
  "day.debate",
  "day.vote",
  "sheriff.elected",
  "sheriff.none",
  "sheriff.changed",
  "sheriff.vacant",
  "vote.eliminated",
  "vote.tie",
  "vote.nobody",
  "vote.runoff",
  "reaction.hunter-shot",
  "reaction.sheriff-successor",
  "reaction.sheriff-tiebreak",
  "bear.growled",
  "elder.villagePowersLost",
  "private.loversLinked",
  "private.seerResult",
  "private.wildChildModel",
  "private.wildChildTransformed",
  "private.wolfHoundChose",
  "private.wolvesChoseVictim",
  "private.wolvesNoVictim",
  "private.playerInfected",
  "private.foxWolfNearby",
  "private.foxNoWolf",
  "private.playersCharmed",
  "private.elderResisted",
  ...WINNER_TEAMS.map((team) => `end.${team}` as const),
] as const;

export type NarrationKey = (typeof NARRATION_KEYS)[number];

/** A player mentioned in a line: the id for the UI (highlights) and the name for the text. */
export interface NarratedPlayer {
  id: PlayerId;
  name: string;
}

/**
 * Values that fill a text. Roles, sides and teams are ids: the client translates them.
 * Lists of players are joined by the client with its locale's list format.
 */
export interface NarrationParams {
  player?: NarratedPlayer;
  players?: NarratedPlayer[];
  role?: RoleId;
  side?: Side;
  count?: number;
  day?: number;
}

export interface NarrationLine {
  key: NarrationKey;
  params: NarrationParams;
}
