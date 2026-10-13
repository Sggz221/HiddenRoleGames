import type { GameActionType, PendingAction, PlayerId } from "@howlsinthedark/shared";
import { alivePlayers, findPlayer, type GameState, hasPower, type PlayerState } from "./state.js";

const pending = (
  types: GameActionType[],
  targets: PlayerState[] | PlayerId[] = [],
): PendingAction => ({
  types,
  targets: targets.map((target) => (typeof target === "string" ? target : target.id)),
});

const others = (state: GameState, self: PlayerId) =>
  alivePlayers(state).filter((player) => player.id !== self);

/**
 * What `playerId` may do right now. This single function drives both action validation
 * and the `pending` field of the player's view, so they can never disagree.
 */
export function pendingActionFor(state: GameState, playerId: PlayerId): PendingAction | null {
  const player = findPlayer(state, playerId);
  if (!player || state.result) return null;
  const { phase } = state;
  // Reactions belong to players who just died (Hunter, Sheriff); everything else needs the living.
  if (phase.kind !== "reaction" && !player.alive) return null;

  switch (phase.kind) {
    case "ended":
      return null;

    case "reaction": {
      const { decision } = phase;
      if (decision.actor !== playerId) return null;
      if (decision.kind === "sheriff-tiebreak")
        return pending(["sheriffTieBreak"], decision.candidates);
      const type = decision.kind === "hunter-shot" ? "hunterShoot" : "sheriffSuccessor";
      return pending(
        decision.kind === "hunter-shot" ? [type, "skip"] : [type],
        others(state, playerId),
      );
    }

    case "day":
      switch (phase.step) {
        case "debate":
          return null;
        case "sheriff-election":
          return pending(["vote"], alivePlayers(state));
        case "vote":
          return pending(["vote"], others(state, playerId));
        case "runoff":
          return pending(
            ["vote"],
            state.runoffCandidates.filter((id) => id !== playerId),
          );
      }
      return null;

    case "night":
      return nightPending(state, player);
  }
}

function nightPending(state: GameState, player: PlayerState): PendingAction | null {
  if (state.phase.kind !== "night") return null;
  const night = state.night;
  const can = hasPower(state, player);

  switch (state.phase.step) {
    case "cupid":
      return player.role === "cupid" ? pending(["cupidLink", "skip"], alivePlayers(state)) : null;

    case "seer":
      return player.role === "seer" && can
        ? pending(["seerInspect", "skip"], others(state, player.id))
        : null;

    case "wild-child":
      return player.role === "wild-child"
        ? pending(["wildChildModel"], others(state, player.id))
        : null;

    case "wolf-hound":
      return player.role === "wolf-hound" ? pending(["wolfHoundChoose"]) : null;

    case "salvador":
      return player.role === "salvador" && can
        ? pending(
            ["salvadorProtect", "skip"],
            alivePlayers(state).filter((target) => target.id !== state.salvadorLast),
          )
        : null;

    case "wolves":
      return player.side === "wolves"
        ? pending(
            ["wolfVote"],
            alivePlayers(state).filter((target) => target.side !== "wolves"),
          )
        : null;

    case "infected-father":
      return player.role === "infected-father" &&
        player.side === "wolves" &&
        !state.infectUsed &&
        night.wolvesVictim !== null
        ? pending(["infect", "skip"])
        : null;

    case "big-bad-wolf":
      return player.role === "big-bad-wolf" && player.side === "wolves" && !state.wolfHasDied
        ? pending(
            ["bigBadWolfKill", "skip"],
            alivePlayers(state).filter(
              (target) => target.side !== "wolves" && target.id !== night.wolvesVictim,
            ),
          )
        : null;

    case "white-werewolf":
      return player.role === "white-werewolf"
        ? pending(
            ["whiteWolfKill", "skip"],
            others(state, player.id).filter((target) => target.side === "wolves"),
          )
        : null;

    case "witch":
      return player.role === "witch" && can && (!state.witchHealUsed || !state.witchPoisonUsed)
        ? pending(["witch", "skip"], alivePlayers(state))
        : null;

    case "fox":
      return player.role === "fox" && can && state.foxActive
        ? pending(["foxSniff", "skip"], alivePlayers(state))
        : null;

    case "piper":
      return player.role === "piper" && player.side === "village"
        ? pending(
            ["piperCharm", "skip"],
            others(state, player.id).filter((target) => !state.charmed.includes(target.id)),
          )
        : null;
  }
}

/** Victims the Witch may heal tonight (wolf kills not prevented by infection). */
export const witchHealable = (state: GameState): PlayerId[] =>
  [state.night.wolvesVictim, state.night.bigBadWolfVictim].filter(
    (id): id is PlayerId => id !== null,
  );
