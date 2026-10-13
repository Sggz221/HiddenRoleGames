import type { PlayerId } from "./actions.js";

/** Night steps in call order. A step runs if its role is in the deck, alive or not (no timing leaks). */
export const NIGHT_STEPS = [
  "cupid",
  "seer",
  "wild-child",
  "wolf-hound",
  "salvador",
  "wolves",
  "infected-father",
  "big-bad-wolf",
  "white-werewolf",
  "witch",
  "fox",
  "piper",
] as const;
export type NightStep = (typeof NIGHT_STEPS)[number];

export type DayStep = "sheriff-election" | "debate" | "vote" | "runoff";

/** Decisions that interrupt the flow until resolved (or timed out). */
export type Decision =
  | { kind: "hunter-shot"; actor: PlayerId }
  | { kind: "sheriff-successor"; actor: PlayerId }
  | { kind: "sheriff-tiebreak"; actor: PlayerId; candidates: PlayerId[] };

export type Phase =
  | { kind: "night"; step: NightStep }
  | { kind: "day"; step: DayStep }
  | { kind: "reaction"; decision: Decision }
  | { kind: "ended" };

export type WinnerTeam =
  | "village"
  | "wolves"
  | "lovers"
  | "white-werewolf"
  | "piper"
  | "angel"
  | "none";

export interface GameResult {
  team: WinnerTeam;
  winners: PlayerId[];
}
