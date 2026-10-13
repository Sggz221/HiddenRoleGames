import type { DayStep, GameEvent, NightStep, Phase, PlayerId, RoleId } from "@aullidos/shared";
import { NIGHT_STEPS } from "@aullidos/shared";
import { kill, packIds, resolveDawn } from "./deaths.js";
import {
  ALL,
  alivePlayers,
  Draft,
  deckHas,
  emptyNight,
  findPlayer,
  type GameState,
  hasPower,
  isAlive,
  livingNeighbours,
  to,
} from "./state.js";
import { evaluateWinner } from "./win.js";

/**
 * Night steps for a given night. Steps depend on the deck only (not on who is alive),
 * so the length of the night never reveals information.
 */
export function nightSteps(state: GameState, night: number): NightStep[] {
  const has = (role: RoleId) => deckHas(state, role);
  return NIGHT_STEPS.filter((step) => {
    switch (step) {
      case "cupid":
      case "wild-child":
      case "wolf-hound":
        return night === 1 && has(step);
      case "wolves":
        return true;
      case "white-werewolf":
        return has(step) && night % 2 === 0;
      default:
        return has(step);
    }
  });
}

/** Moves the game to its next phase, resolving the current one. Called on timer expiry or early completion. */
export function advancePhase(state: GameState): { state: GameState; events: GameEvent[] } {
  const draft = new Draft(state);
  const { phase } = draft.state;

  switch (phase.kind) {
    case "ended":
      break;
    case "night":
      finishNightStep(draft, phase.step);
      nextNightStep(draft, phase.step);
      break;
    case "day":
      finishDayStep(draft, phase.step);
      break;
    case "reaction":
      resolveDecision(draft);
      break;
  }

  return draft.finish();
}

/** Whether the server may skip the rest of the timer. Never true at night (timing leaks). */
export function canAdvanceEarly(state: GameState): boolean {
  const { phase } = state;
  if (phase.kind === "reaction") return state.decisionChoice !== undefined;
  if (phase.kind !== "day" || phase.step === "debate") return false;
  return alivePlayers(state).every((player) => player.id in state.votes);
}

export function phaseDurationSeconds(state: GameState): number {
  const { timers } = state.config;
  const { phase } = state;
  switch (phase.kind) {
    case "night":
      return timers.nightStepSeconds;
    case "reaction":
      return timers.reactionSeconds;
    case "ended":
      return 0;
    case "day":
      switch (phase.step) {
        case "debate":
          return timers.debateSeconds;
        case "sheriff-election":
          return timers.sheriffElectionSeconds;
        default:
          return timers.voteSeconds;
      }
  }
}

// ---------------------------------------------------------------------------
// Flow

export function enterPhase(draft: Draft, phase: Phase): void {
  draft.state.phase = phase;
  draft.emit({ type: "phaseChanged", phase, day: draft.state.day }, ALL);
}

export function startNight(draft: Draft): void {
  const { state } = draft;
  if (state.day >= state.config.maxDays) {
    endGame(draft, { team: "none", winners: [] });
    return;
  }
  state.day += 1;
  state.night = emptyNight();
  state.votes = {};
  const [first] = nightSteps(state, state.day);
  enterPhase(draft, { kind: "night", step: first ?? "wolves" });
}

export function startDay(draft: Draft): void {
  const { state } = draft;
  state.votes = {};
  const electSheriff = state.config.sheriff && !state.sheriffElectionHeld;
  enterPhase(draft, { kind: "day", step: electSheriff ? "sheriff-election" : "debate" });
}

/** After any resolution: handle pending decisions, then victory, then continue the cycle. */
function continueFlow(draft: Draft): void {
  const { state } = draft;
  if (state.result) {
    endGame(draft, state.result);
    return;
  }
  const [decision] = state.decisions;
  if (decision) {
    delete state.decisionChoice;
    enterPhase(draft, { kind: "reaction", decision });
    return;
  }
  const winner = evaluateWinner(state);
  if (winner) {
    endGame(draft, winner);
    return;
  }
  const resume = state.resume;
  state.resume = null;
  if (resume === "day") startDay(draft);
  else startNight(draft);
}

function endGame(draft: Draft, result: NonNullable<GameState["result"]>): void {
  const { state } = draft;
  state.result = result;
  state.phase = { kind: "ended" };
  const roles = Object.fromEntries(state.players.map((player) => [player.id, player.role]));
  draft.emit({ type: "phaseChanged", phase: state.phase, day: state.day }, ALL);
  draft.emit({ type: "gameEnded", result, roles }, ALL);
}

function nextNightStep(draft: Draft, current: NightStep): void {
  const { state } = draft;
  if (state.result) {
    endGame(draft, state.result);
    return;
  }
  const steps = nightSteps(state, state.day);
  const next = steps[steps.indexOf(current) + 1];
  if (next) {
    enterPhase(draft, { kind: "night", step: next });
    return;
  }
  resolveDawn(draft);
  state.night = emptyNight();
  state.resume = "day";
  continueFlow(draft);
}

// ---------------------------------------------------------------------------
// Night steps

function finishNightStep(draft: Draft, step: NightStep): void {
  const { state } = draft;
  const { night } = state;
  const holder = (role: RoleId) =>
    state.players.find((player) => player.role === role && player.alive);

  switch (step) {
    case "cupid": {
      const cupid = holder("cupid");
      if (cupid && night.cupid) {
        state.lovers = night.cupid;
        draft.emit({ type: "loversLinked", lovers: night.cupid }, to(cupid.id, ...night.cupid));
      }
      break;
    }

    case "seer": {
      const seer = holder("seer");
      const target = night.seerTarget ? findPlayer(state, night.seerTarget) : undefined;
      if (seer && hasPower(state, seer) && target) {
        state.seerResults.push({ target: target.id, role: target.role });
        draft.emit({ type: "seerResult", target: target.id, role: target.role }, to(seer.id));
      }
      break;
    }

    case "wild-child": {
      const child = holder("wild-child");
      if (!child) break;
      const candidates = alivePlayers(state).filter((player) => player.id !== child.id);
      const model =
        night.wildChildModel ?? (candidates.length ? draft.rng.pick(candidates).id : null);
      if (model) {
        state.wildChildModel = model;
        draft.emit({ type: "wildChildModelChosen", model }, to(child.id));
      }
      break;
    }

    case "wolf-hound": {
      const hound = holder("wolf-hound");
      if (!hound) break;
      const side = night.wolfHoundSide ?? "village";
      state.wolfHoundSide = side;
      hound.side = side;
      draft.emit({ type: "wolfHoundChose", side }, to(hound.id));
      break;
    }

    case "salvador": {
      const salvador = holder("salvador");
      if (!salvador || !hasPower(state, salvador)) break;
      // Skipping (or no valid target) clears the memory: any player may be shielded next night.
      const target = night.salvadorTarget;
      state.salvadorLast = target && isAlive(state, target) ? target : null;
      if (!state.salvadorLast) night.salvadorTarget = null;
      break;
    }

    case "wolves": {
      const pack = packIds(draft);
      const votes = Object.entries(night.wolfVotes)
        .filter(([voter, target]) => pack.includes(voter) && isAlive(state, target))
        .map(([, target]) => target);
      const victim = pickMostVoted(draft, votes);
      night.wolvesVictim = victim;
      draft.emit({ type: "wolvesChoseVictim", victim }, to(...pack));
      break;
    }

    case "infected-father": {
      const father = holder("infected-father");
      const victim = night.wolvesVictim ? findPlayer(state, night.wolvesVictim) : undefined;
      if (father?.side !== "wolves" || state.infectUsed || !night.infect || !victim) break;
      // A shielded victim cannot be infected either; the power is not spent.
      if (victim.id === night.salvadorTarget) break;
      state.infectUsed = true;
      // The Elder is immune: the attack goes on as a normal wolf attack.
      if (victim.role === "elder") break;
      victim.infected = true;
      victim.side = "wolves";
      night.wolvesVictim = null;
      draft.emit({ type: "playerInfected", player: victim.id }, to(...packIds(draft)));
      break;
    }

    case "witch":
      if (night.witchHeal) state.witchHealUsed = true;
      if (night.witchPoison) state.witchPoisonUsed = true;
      break;

    case "fox": {
      const fox = holder("fox");
      if (!fox || !hasPower(state, fox) || !state.foxActive || !night.foxTarget) break;
      const group = [night.foxTarget, ...livingNeighbours(state, night.foxTarget).map((p) => p.id)];
      const wolfNearby = group.some((id) => findPlayer(state, id)?.side === "wolves");
      state.foxResults.push({ target: night.foxTarget, wolfNearby });
      if (!wolfNearby) state.foxActive = false;
      draft.emit({ type: "foxResult", target: night.foxTarget, wolfNearby }, to(fox.id));
      break;
    }

    case "piper": {
      const piper = holder("piper");
      if (piper?.side !== "village" || night.piperTargets.length === 0) break;
      state.charmed = [...new Set([...state.charmed, ...night.piperTargets])];
      const audience = [piper.id, ...state.charmed.filter((id) => isAlive(state, id))];
      draft.emit({ type: "playersCharmed", charmed: state.charmed }, to(...audience));
      break;
    }

    // Big Bad Wolf and White Werewolf choices are resolved at dawn.
    case "big-bad-wolf":
    case "white-werewolf":
      break;
  }
}

/** Plurality; ties are broken with the seeded RNG. */
function pickMostVoted(draft: Draft, targets: PlayerId[]): PlayerId | null {
  const top = topCandidates(targets.map((target) => [target, 1] as const));
  return top.length ? draft.rng.pick(top) : null;
}

function topCandidates(weighted: Iterable<readonly [PlayerId, number]>): PlayerId[] {
  const totals = new Map<PlayerId, number>();
  for (const [target, weight] of weighted) totals.set(target, (totals.get(target) ?? 0) + weight);
  const max = Math.max(0, ...totals.values());
  if (max === 0) return [];
  return [...totals].filter(([, total]) => total === max).map(([target]) => target);
}

// ---------------------------------------------------------------------------
// Day steps

function finishDayStep(draft: Draft, step: DayStep): void {
  const { state } = draft;
  switch (step) {
    case "sheriff-election": {
      const votes = validVotes(
        state,
        alivePlayers(state).map((p) => p.id),
      );
      const sheriff = pickMostVoted(
        draft,
        votes.map(([, target]) => target),
      );
      state.sheriff = sheriff;
      state.sheriffElectionHeld = true;
      draft.emit({ type: "sheriffElected", player: sheriff }, ALL);
      state.votes = {};
      enterPhase(draft, { kind: "day", step: "debate" });
      return;
    }

    case "debate":
      state.votes = {};
      enterPhase(draft, { kind: "day", step: "vote" });
      return;

    case "vote":
      resolveVote(
        draft,
        alivePlayers(state).map((p) => p.id),
        false,
      );
      return;

    case "runoff":
      resolveVote(draft, state.runoffCandidates, true);
      return;
  }
}

function validVotes(state: GameState, candidates: PlayerId[]): [PlayerId, PlayerId][] {
  return Object.entries(state.votes).filter(
    (entry): entry is [PlayerId, PlayerId] =>
      entry[1] !== null && isAlive(state, entry[0]) && candidates.includes(entry[1]),
  );
}

function resolveVote(draft: Draft, candidates: PlayerId[], isRunoff: boolean): void {
  const { state } = draft;
  const weight = (voter: PlayerId) => (voter === state.sheriff ? 2 : 1);
  const tied = topCandidates(
    validVotes(state, candidates).map(([voter, target]) => [target, weight(voter)] as const),
  );
  state.votes = {};
  state.runoffCandidates = [];
  state.resume = "night";

  if (tied.length === 1 && tied[0]) {
    draft.emit({ type: "voteResult", eliminated: tied[0], tied: [] }, ALL);
    kill(draft, tied[0], "vote");
  } else if (tied.length > 1 && !isRunoff) {
    const rule = state.config.voteTieRule;
    const sheriffAlive = isAlive(state, state.sheriff);
    if (rule === "sheriff" && sheriffAlive && state.sheriff) {
      draft.emit({ type: "voteResult", eliminated: null, tied }, ALL);
      state.decisions.push({ kind: "sheriff-tiebreak", actor: state.sheriff, candidates: tied });
    } else if (rule === "no-elimination") {
      draft.emit({ type: "voteResult", eliminated: null, tied }, ALL);
    } else {
      state.runoffCandidates = tied;
      state.resume = null;
      draft.emit({ type: "runoffStarted", candidates: tied }, ALL);
      enterPhase(draft, { kind: "day", step: "runoff" });
      return;
    }
  } else {
    draft.emit({ type: "voteResult", eliminated: null, tied }, ALL);
  }

  continueFlow(draft);
}

// ---------------------------------------------------------------------------
// Reactions

function resolveDecision(draft: Draft): void {
  const { state } = draft;
  const decision = state.decisions.shift();
  const choice = state.decisionChoice ?? null;
  delete state.decisionChoice;

  if (decision?.kind === "hunter-shot" && choice && isAlive(state, choice)) {
    kill(draft, choice, "hunter");
  }

  if (decision?.kind === "sheriff-successor") {
    const candidates = alivePlayers(state);
    const successor =
      choice && isAlive(state, choice)
        ? choice
        : candidates.length
          ? draft.rng.pick(candidates).id
          : null;
    state.sheriff = successor;
    draft.emit({ type: "sheriffChanged", player: successor }, ALL);
  }

  if (decision?.kind === "sheriff-tiebreak") {
    if (choice && decision.candidates.includes(choice) && isAlive(state, choice)) {
      draft.emit({ type: "voteResult", eliminated: choice, tied: [] }, ALL);
      kill(draft, choice, "vote");
    }
  }

  continueFlow(draft);
}
