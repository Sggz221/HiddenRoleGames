import { z } from "zod";
import { MAX_PLAYERS, MIN_PLAYERS } from "../app.js";
import { ROLES, type RoleId, roleIdSchema } from "./roles.js";

export const revealOnDeathSchema = z.enum(["role", "side", "none"]);
export type RevealOnDeath = z.infer<typeof revealOnDeathSchema>;

/**
 * - `runoff`: tied players face a second vote; a second tie eliminates nobody (official rule).
 * - `no-elimination`: a tie eliminates nobody.
 * - `sheriff`: the Sheriff picks among the tied players (falls back to `runoff` without Sheriff).
 */
export const voteTieRuleSchema = z.enum(["runoff", "no-elimination", "sheriff"]);
export type VoteTieRule = z.infer<typeof voteTieRuleSchema>;

export const timersSchema = z.object({
  /** Every night step lasts exactly this long, even if the role is dead or absent (no timing leaks). */
  nightStepSeconds: z.number().int().min(5).max(180).default(30),
  debateSeconds: z.number().int().min(15).max(900).default(180),
  voteSeconds: z.number().int().min(10).max(300).default(60),
  sheriffElectionSeconds: z.number().int().min(10).max(300).default(90),
  /** Hunter shot, Sheriff succession and tie-break decisions. */
  reactionSeconds: z.number().int().min(5).max(120).default(30),
});
export type Timers = z.infer<typeof timersSchema>;

/** Config fields without the deck-wide checks (lets `room:start` omit or override fields). */
export const gameConfigBaseSchema = z.object({
  /** The deck: one card per player. */
  roles: z.array(roleIdSchema).min(MIN_PLAYERS).max(MAX_PLAYERS),
  sheriff: z.boolean().default(true),
  revealOnDeath: revealOnDeathSchema.default("role"),
  voteTieRule: voteTieRuleSchema.default("runoff"),
  /** Dead players see every role and secret event (they "keep their eyes open"). */
  deadSeeEverything: z.boolean().default(true),
  /** Safety valve: after this many days the game ends without a winner. */
  maxDays: z.number().int().min(5).max(100).default(40),
  timers: timersSchema.prefault({}),
});

export const gameConfigSchema = gameConfigBaseSchema.superRefine((config, ctx) => {
  for (const issue of validateDeck(config.roles)) {
    ctx.addIssue({ code: "custom", path: ["roles"], message: issue });
  }
});

export type GameConfig = z.infer<typeof gameConfigSchema>;
export type GameConfigInput = z.input<typeof gameConfigSchema>;

/** Returns human-readable (developer-facing) deck problems; empty when the deck is valid. */
export function validateDeck(roles: readonly RoleId[]): string[] {
  const issues: string[] = [];
  const counts = new Map<RoleId, number>();
  for (const role of roles) counts.set(role, (counts.get(role) ?? 0) + 1);

  for (const [role, count] of counts) {
    const { maxCopies, exactCopies } = ROLES[role];
    if (count > maxCopies) issues.push(`Role "${role}" appears ${count} times (max ${maxCopies})`);
    if (exactCopies !== undefined && count !== exactCopies) {
      issues.push(`Role "${role}" must appear exactly ${exactCopies} times`);
    }
  }

  const wolves = roles.filter((role) => ROLES[role].initialSide === "wolves").length;
  if (wolves === 0) issues.push("The deck needs at least one wolf");
  if (wolves >= roles.length - wolves) issues.push("Wolves must be a minority of the deck");

  return issues;
}

/**
 * Recommended starting decks (official guidance: wolves ≈ a quarter of the table,
 * mostly simple villagers for new groups). Index = number of players.
 */
export function recommendedDeck(players: number): RoleId[] {
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(`players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }
  const wolves = Math.max(1, Math.floor(players / 4));
  const specials: RoleId[] = ["seer", "witch", "hunter", "cupid", "little-girl", "elder", "fox"];
  const deck: RoleId[] = Array.from({ length: wolves }, () => "werewolf");
  for (const role of specials) {
    if (deck.length >= players - 1) break;
    deck.push(role);
  }
  while (deck.length < players) deck.push("villager");
  return deck;
}
