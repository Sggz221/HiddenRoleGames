import { z } from "zod";
import { sideSchema } from "./roles.js";

export const playerIdSchema = z.string().min(1).max(64);
export type PlayerId = z.infer<typeof playerIdSchema>;

const target = playerIdSchema;

/**
 * Intents a client may send (`game:action`). The server validates the payload with this
 * schema and the engine validates it against the rules (phase, role, alive, targets...).
 */
export const gameActionSchema = z.discriminatedUnion("type", [
  /** Day vote, runoff vote or Sheriff election. `null` = abstain. */
  z.object({ type: z.literal("vote"), target: target.nullable() }),
  z.object({ type: z.literal("cupidLink"), targets: z.tuple([target, target]) }),
  z.object({ type: z.literal("seerInspect"), target }),
  z.object({ type: z.literal("wildChildModel"), target }),
  z.object({ type: z.literal("wolfHoundChoose"), side: sideSchema }),
  /** The Salvador shields one player from the wolves tonight (not the same one twice in a row). */
  z.object({ type: z.literal("salvadorProtect"), target }),
  z.object({ type: z.literal("wolfVote"), target }),
  z.object({ type: z.literal("infect"), infect: z.boolean() }),
  z.object({ type: z.literal("bigBadWolfKill"), target }),
  z.object({ type: z.literal("whiteWolfKill"), target }),
  /** Both are optional; the Witch submits her whole decision at once. */
  z.object({ type: z.literal("witch"), heal: target.nullable(), poison: target.nullable() }),
  /** The Fox names the centre of three neighbours. */
  z.object({ type: z.literal("foxSniff"), target }),
  z.object({
    type: z.literal("piperCharm"),
    targets: z.array(target).min(1).max(2),
  }),
  z.object({ type: z.literal("hunterShoot"), target }),
  z.object({ type: z.literal("sheriffSuccessor"), target }),
  z.object({ type: z.literal("sheriffTieBreak"), target: target.nullable() }),
  /** Explicitly pass on an optional action. */
  z.object({ type: z.literal("skip") }),
]);

export type GameAction = z.infer<typeof gameActionSchema>;
export type GameActionType = GameAction["type"];
