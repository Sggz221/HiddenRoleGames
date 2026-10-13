import type {
  DeathReveal,
  GameEventPayload,
  NarratedPlayer,
  NarrationLine,
  Phase,
  PlayerId,
} from "@aullidos/shared";
import { nightSteps } from "./advance.js";
import { findPlayer, type GameState } from "./state.js";

/**
 * Turns one batch of events into what the narrator says, in order. Pass only the events the
 * listener received (`eventsFor`): the narration is built from them alone, so it can never
 * reveal more than the events themselves. Votes as they are cast are left to the UI.
 */
export function narrate(state: GameState, events: readonly GameEventPayload[]): NarrationLine[] {
  const who = (id: PlayerId): NarratedPlayer => ({ id, name: findPlayer(state, id)?.name ?? id });
  const lines: NarrationLine[] = [];
  const say = (key: NarrationLine["key"], params: NarrationLine["params"] = {}) =>
    lines.push({ key, params });

  events.forEach((event, index) => {
    switch (event.type) {
      case "gameStarted":
        say("game.started", { count: event.players.length });
        break;
      case "roleAssigned":
        say("game.yourRole", { role: event.role });
        break;
      case "phaseChanged":
        narratePhase(state, event.phase, event.day, say, who);
        break;
      case "dawn": {
        // Every death in the same batch as the dawn happened during the night (or its grief).
        const count = events.slice(index + 1).filter((e) => e.type === "playerDied").length;
        say(count === 0 ? "dawn.nobody" : count === 1 ? "dawn.one" : "dawn.many", { count });
        break;
      }
      case "playerDied": {
        const reveal: DeathReveal = event.role ? "role" : event.side ? "side" : "hidden";
        say(`death.${event.cause}.${reveal}`, {
          player: who(event.player),
          ...(event.role ? { role: event.role } : {}),
          ...(event.side ? { side: event.side } : {}),
        });
        break;
      }
      case "voteCast":
      case "wolfVoteCast":
        break;
      case "voteResult":
        if (event.eliminated) say("vote.eliminated", { player: who(event.eliminated) });
        else if (event.tied.length > 1) say("vote.tie", { players: event.tied.map(who) });
        else say("vote.nobody");
        break;
      case "runoffStarted":
        say("vote.runoff", { players: event.candidates.map(who) });
        break;
      case "sheriffElected":
        if (event.player) say("sheriff.elected", { player: who(event.player) });
        else say("sheriff.none");
        break;
      case "sheriffChanged":
        if (event.player) say("sheriff.changed", { player: who(event.player) });
        else say("sheriff.vacant");
        break;
      case "wolvesChoseVictim":
        if (event.victim) say("private.wolvesChoseVictim", { player: who(event.victim) });
        else say("private.wolvesNoVictim");
        break;
      case "loversLinked":
        say("private.loversLinked", { players: event.lovers.map(who) });
        break;
      case "seerResult":
        say("private.seerResult", { player: who(event.target), role: event.role });
        break;
      case "wildChildModelChosen":
        say("private.wildChildModel", { player: who(event.model) });
        break;
      case "wildChildTransformed":
        say("private.wildChildTransformed");
        break;
      case "wolfHoundChose":
        say("private.wolfHoundChose", { side: event.side });
        break;
      case "playerInfected":
        say("private.playerInfected", { player: who(event.player) });
        break;
      case "foxResult":
        say(event.wolfNearby ? "private.foxWolfNearby" : "private.foxNoWolf", {
          player: who(event.target),
        });
        break;
      case "playersCharmed":
        say("private.playersCharmed", { players: event.charmed.map(who) });
        break;
      case "bearGrowled":
        say("bear.growled");
        break;
      case "villagePowersLost":
        say("elder.villagePowersLost");
        break;
      case "elderResisted":
        say("private.elderResisted");
        break;
      case "gameEnded":
        say(`end.${event.result.team}`, { players: event.result.winners.map(who) });
        break;
      default:
        assertNever(event);
    }
  });

  return lines;
}

function narratePhase(
  state: GameState,
  phase: Phase,
  day: number,
  say: (key: NarrationLine["key"], params?: NarrationLine["params"]) => void,
  who: (id: PlayerId) => NarratedPlayer,
): void {
  switch (phase.kind) {
    case "night":
      if (nightSteps(state, day)[0] === phase.step) say("night.falls", { day });
      say(`night.wakes.${phase.step}`);
      break;
    case "day":
      // The runoff is announced by its own event, with the candidates.
      if (phase.step === "sheriff-election") say("day.sheriffElection");
      else if (phase.step === "debate") say("day.debate", { day });
      else if (phase.step === "vote") say("day.vote");
      break;
    case "reaction": {
      const { decision } = phase;
      say(`reaction.${decision.kind}`, {
        player: who(decision.actor),
        ...(decision.kind === "sheriff-tiebreak" ? { players: decision.candidates.map(who) } : {}),
      });
      break;
    }
    case "ended":
      // Announced by `gameEnded`, which carries the winners.
      break;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event ${JSON.stringify(value)}`);
}
