import type { GameAction, GameEvent, PlayerId } from "@howlsinthedark/shared";
import { packIds } from "./deaths.js";
import { pendingActionFor, witchHealable } from "./pending.js";
import { ALL, Draft, type GameState, to } from "./state.js";

export type EngineErrorCode = "NOT_ALLOWED" | "INVALID_TARGET" | "DUPLICATE_TARGET" | "POTION_USED";

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };

/**
 * Records a player's intent for the current phase. Effects are resolved when the phase
 * advances (`advancePhase`), so changing one's mind before the timer ends is allowed.
 */
export function applyAction(state: GameState, actor: PlayerId, action: GameAction): ActionResult {
  try {
    return { ok: true, ...record(state, actor, action) };
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error };
    throw error;
  }
}

function record(state: GameState, actor: PlayerId, action: GameAction) {
  const allowed = pendingActionFor(state, actor);
  if (!allowed?.types.includes(action.type)) {
    throw new EngineError("NOT_ALLOWED", `Action "${action.type}" is not allowed now`);
  }
  const requireTarget = (target: PlayerId | null) => {
    if (target !== null && !allowed.targets.includes(target)) {
      throw new EngineError("INVALID_TARGET", `Invalid target ${target}`);
    }
  };

  const draft = new Draft(state);
  const { state: s } = draft;
  const night = s.night;

  switch (action.type) {
    case "skip":
      if (s.phase.kind === "reaction") s.decisionChoice = null;
      break;

    case "vote":
      requireTarget(action.target);
      s.votes[actor] = action.target;
      draft.emit({ type: "voteCast", voter: actor, target: action.target }, ALL);
      break;

    case "cupidLink": {
      const [a, b] = action.targets;
      if (a === b)
        throw new EngineError("DUPLICATE_TARGET", "Lovers must be two different players");
      requireTarget(a);
      requireTarget(b);
      night.cupid = [a, b];
      break;
    }

    case "seerInspect":
      requireTarget(action.target);
      night.seerTarget = action.target;
      break;

    case "wildChildModel":
      requireTarget(action.target);
      night.wildChildModel = action.target;
      break;

    case "wolfHoundChoose":
      night.wolfHoundSide = action.side;
      break;

    case "salvadorProtect":
      requireTarget(action.target);
      night.salvadorTarget = action.target;
      break;

    case "wolfVote":
      requireTarget(action.target);
      night.wolfVotes[actor] = action.target;
      draft.emit(
        { type: "wolfVoteCast", voter: actor, target: action.target },
        to(...packIds(draft)),
      );
      break;

    case "infect":
      night.infect = action.infect;
      break;

    case "bigBadWolfKill":
      requireTarget(action.target);
      night.bigBadWolfVictim = action.target;
      break;

    case "whiteWolfKill":
      requireTarget(action.target);
      night.whiteWolfVictim = action.target;
      break;

    case "witch": {
      if (action.heal !== null) {
        if (s.witchHealUsed) throw new EngineError("POTION_USED", "Healing potion already used");
        if (!witchHealable(s).includes(action.heal)) {
          throw new EngineError("INVALID_TARGET", "Only tonight's wolf victims can be healed");
        }
      }
      if (action.poison !== null) {
        if (s.witchPoisonUsed) throw new EngineError("POTION_USED", "Poison already used");
        requireTarget(action.poison);
      }
      night.witchHeal = action.heal;
      night.witchPoison = action.poison;
      break;
    }

    case "foxSniff":
      requireTarget(action.target);
      night.foxTarget = action.target;
      break;

    case "piperCharm": {
      const targets = [...new Set(action.targets)];
      if (targets.length !== action.targets.length) {
        throw new EngineError("DUPLICATE_TARGET", "Charm two different players");
      }
      for (const target of targets) requireTarget(target);
      night.piperTargets = targets;
      break;
    }

    case "hunterShoot":
    case "sheriffSuccessor":
      requireTarget(action.target);
      s.decisionChoice = action.target;
      break;

    case "sheriffTieBreak":
      requireTarget(action.target);
      s.decisionChoice = action.target;
      break;
  }

  return draft.finish();
}
