import type { GameEvent, PlayerId, PlayerView, PublicPlayer } from "@howlsinthedark/shared";
import { chatAccessFor } from "./chat.js";
import { choiceOf } from "./choice.js";
import { pendingActionFor } from "./pending.js";
import { findPlayer, type GameState, isAlive, loverOf, type PlayerState } from "./state.js";

/** Dead players (when allowed) and everyone after the end see the whole board. */
function isOmniscient(state: GameState, viewer: PlayerState): boolean {
  return state.phase.kind === "ended" || (!viewer.alive && state.config.deadSeeEverything);
}

/**
 * Projects the secret state into what `viewerId` may see. This is the ONLY way game state
 * leaves the server: never send `GameState` itself.
 */
export function projectFor(state: GameState, viewerId: PlayerId): PlayerView {
  const viewer = findPlayer(state, viewerId);
  if (!viewer) throw new Error(`Unknown viewer ${viewerId}`);

  const omniscient = isOmniscient(state, viewer);
  const inPack = viewer.alive && viewer.side === "wolves";
  const seesCharms = omniscient || viewer.role === "piper" || state.charmed.includes(viewer.id);
  const seesLovers = omniscient || viewer.role === "cupid" || loverOf(state, viewer.id) !== null;
  const lover = loverOf(state, viewer.id);
  const sisters =
    viewer.role === "sister"
      ? state.players.filter((p) => p.role === "sister" && p.id !== viewer.id).map((p) => p.id)
      : [];
  const inspected = new Map(state.seerResults.map((result) => [result.target, result.role]));

  const players = state.players.map((player): PublicPlayer => {
    const view: PublicPlayer = {
      id: player.id,
      name: player.name,
      seat: player.seat,
      alive: player.alive,
      isSheriff: player.alive && state.sheriff === player.id,
    };
    const self = player.id === viewer.id;
    const revealDead = !player.alive ? state.config.revealOnDeath : "none";

    if (self || omniscient || revealDead === "role") {
      view.role = player.role;
      view.side = player.side;
    } else if (revealDead === "side") {
      view.side = player.side;
    }
    if (!view.role && sisters.includes(player.id)) view.role = player.role;
    const inspectedRole = viewer.role === "seer" ? inspected.get(player.id) : undefined;
    if (!view.role && inspectedRole) view.role = inspectedRole;
    if (omniscient || inPack) view.isWolfAlly = player.side === "wolves";
    if (seesCharms) view.charmed = state.charmed.includes(player.id);
    if (seesLovers) view.isLover = state.lovers?.includes(player.id) ?? false;
    return view;
  });

  const { phase } = state;
  const isVoteStep = phase.kind === "day" && phase.step !== "debate";
  const isWolfStep = phase.kind === "night" && phase.step === "wolves";
  // Ballots stay secret while the vote is open (no bandwagons, nothing to read into them).
  const votes = !isVoteStep
    ? {}
    : omniscient
      ? { ...state.votes }
      : viewer.id in state.votes
        ? { [viewer.id]: state.votes[viewer.id] ?? null }
        : {};

  return {
    day: state.day,
    phase,
    revealOnDeath: state.config.revealOnDeath,
    you: {
      id: viewer.id,
      role: viewer.role,
      side: viewer.side,
      alive: viewer.alive,
      infected: viewer.infected,
      charmed: state.charmed.includes(viewer.id),
      lover,
      sisters,
      wildChildModel: viewer.role === "wild-child" ? state.wildChildModel : null,
      wolfHoundSide: viewer.role === "wolf-hound" ? state.wolfHoundSide : null,
      witchPotions:
        viewer.role === "witch"
          ? { heal: !state.witchHealUsed, poison: !state.witchPoisonUsed }
          : null,
      foxActive: viewer.role === "fox" ? state.foxActive : null,
      salvadorLast: viewer.role === "salvador" ? state.salvadorLast : null,
      seerResults: viewer.role === "seer" ? state.seerResults : [],
      choice: choiceOf(state, viewer.id),
      foxResults: viewer.role === "fox" ? state.foxResults : [],
    },
    players,
    pending: pendingActionFor(state, viewer.id),
    votes,
    voted: phase.kind === "day" ? Object.keys(state.votes).filter((id) => isAlive(state, id)) : [],
    wolfVotes: isWolfStep && (inPack || omniscient) ? { ...state.night.wolfVotes } : null,
    result: state.result,
    chat: chatAccessFor(state, viewer.id),
  };
}

/** Filters events down to those `viewerId` is allowed to receive. */
export function eventsFor(
  state: GameState,
  viewerId: PlayerId,
  events: readonly GameEvent[],
): GameEvent[] {
  const viewer = findPlayer(state, viewerId);
  if (!viewer) return [];
  const omniscient = isOmniscient(state, viewer);
  return events.filter(
    (event) => omniscient || event.audience.kind === "all" || event.audience.ids.includes(viewerId),
  );
}
