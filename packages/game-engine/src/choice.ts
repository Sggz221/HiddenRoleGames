import type { GameAction, PlayerId } from "@howlsinthedark/shared";
import { findPlayer, type GameState } from "./state.js";

/**
 * What `playerId` has chosen so far in the current phase, as the action they would send again.
 * Part of their own view, so a reload or a second device shows the same choice. `null` when
 * they have not chosen (or passed).
 */
export function choiceOf(state: GameState, playerId: PlayerId): GameAction | null {
  const player = findPlayer(state, playerId);
  if (!player || state.result) return null;
  const { phase, night } = state;

  switch (phase.kind) {
    case "ended":
      return null;

    case "reaction": {
      const { decision } = phase;
      const choice = state.decisionChoice;
      if (decision.actor !== playerId || choice === undefined) return null;
      if (decision.kind === "sheriff-tiebreak") return { type: "sheriffTieBreak", target: choice };
      if (choice === null) return null;
      return decision.kind === "hunter-shot"
        ? { type: "hunterShoot", target: choice }
        : { type: "sheriffSuccessor", target: choice };
    }

    case "day":
      if (phase.step === "debate" || !(playerId in state.votes)) return null;
      return { type: "vote", target: state.votes[playerId] ?? null };

    case "night": {
      // Every night step but the pack's is named after the card that acts in it.
      const holds = player.role === phase.step;
      switch (phase.step) {
        case "cupid":
          return holds && night.cupid ? { type: "cupidLink", targets: night.cupid } : null;
        case "seer":
          return holds && night.seerTarget
            ? { type: "seerInspect", target: night.seerTarget }
            : null;
        case "wild-child":
          return holds && night.wildChildModel
            ? { type: "wildChildModel", target: night.wildChildModel }
            : null;
        case "wolf-hound":
          return holds && night.wolfHoundSide
            ? { type: "wolfHoundChoose", side: night.wolfHoundSide }
            : null;
        case "salvador":
          return holds && night.salvadorTarget
            ? { type: "salvadorProtect", target: night.salvadorTarget }
            : null;
        case "wolves": {
          const target = night.wolfVotes[playerId];
          return target ? { type: "wolfVote", target } : null;
        }
        case "infected-father":
          return holds && night.infect !== null ? { type: "infect", infect: night.infect } : null;
        case "big-bad-wolf":
          return holds && night.bigBadWolfVictim
            ? { type: "bigBadWolfKill", target: night.bigBadWolfVictim }
            : null;
        case "white-werewolf":
          return holds && night.whiteWolfVictim
            ? { type: "whiteWolfKill", target: night.whiteWolfVictim }
            : null;
        case "witch":
          return holds && (night.witchHeal || night.witchPoison)
            ? { type: "witch", heal: night.witchHeal, poison: night.witchPoison }
            : null;
        case "fox":
          return holds && night.foxTarget ? { type: "foxSniff", target: night.foxTarget } : null;
        case "piper":
          return holds && night.piperTargets.length
            ? { type: "piperCharm", targets: night.piperTargets }
            : null;
      }
    }
  }
}
