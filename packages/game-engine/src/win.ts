import type { GameResult, PlayerId } from "@howlsinthedark/shared";
import { alivePlayers, type GameState, type PlayerState } from "./state.js";

/** Lovers on different sides abandon their side: they can only win together. */
export function isMixedCouple(state: GameState): boolean {
  if (!state.lovers) return false;
  const [a, b] = state.lovers.map((id) => state.players.find((player) => player.id === id));
  return a !== undefined && b !== undefined && a.side !== b.side;
}

const ids = (players: PlayerState[]): PlayerId[] => players.map((player) => player.id);

/**
 * Evaluates the end-of-game conditions. Returns `null` while the game goes on.
 * The Angel's instant victory is handled when he dies (see deaths.ts).
 */
export function evaluateWinner(state: GameState): GameResult | null {
  if (state.result) return state.result;

  const alive = alivePlayers(state);
  if (alive.length === 0) return { team: "none", winners: [] };

  const mixedLovers: PlayerId[] = isMixedCouple(state) && state.lovers ? [...state.lovers] : [];

  if (
    mixedLovers.length === 2 &&
    alive.length === 2 &&
    alive.every((p) => mixedLovers.includes(p.id))
  ) {
    return { team: "lovers", winners: [...mixedLovers] };
  }

  const piper = alive.find((player) => player.role === "piper" && player.side === "village");
  if (
    piper &&
    alive.every((player) => player.id === piper.id || state.charmed.includes(player.id))
  ) {
    return { team: "piper", winners: [piper.id] };
  }

  if (alive.length === 1 && alive[0]?.role === "white-werewolf") {
    return { team: "white-werewolf", winners: [alive[0].id] };
  }

  const aliveWolves = alive.filter((player) => player.side === "wolves");

  if (aliveWolves.length === 0) {
    const winners = state.players.filter(
      (player) =>
        player.side === "village" && player.role !== "piper" && !mixedLovers.includes(player.id),
    );
    return { team: "village", winners: ids(winners) };
  }

  if (aliveWolves.length === alive.length) {
    // The White Werewolf still hopes to be the last one standing.
    const whiteWolfAlive = alive.some((player) => player.role === "white-werewolf");
    if (whiteWolfAlive) return null;
    const winners = state.players.filter(
      (player) =>
        player.side === "wolves" &&
        player.role !== "white-werewolf" &&
        !mixedLovers.includes(player.id),
    );
    return { team: "wolves", winners: ids(winners) };
  }

  return null;
}
