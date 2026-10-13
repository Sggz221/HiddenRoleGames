import {
  type GameAction,
  type GameConfigInput,
  type GameEvent,
  gameConfigSchema,
  type Phase,
  type PlayerId,
  ROLES,
  type RoleId,
} from "@howlsinthedark/shared";
import { expect } from "vitest";
import { applyAction } from "./actions.js";
import { advancePhase } from "./advance.js";
import { createGame } from "./create.js";
import type { GameState } from "./state.js";

/**
 * Creates a game where seat `i` gets `roles[i]` (no shuffling), players are named p0..pN.
 */
export function setup(
  roles: RoleId[],
  config: Omit<GameConfigInput, "roles"> = {},
): { state: GameState; events: GameEvent[] } {
  const parsed = gameConfigSchema.parse({ sheriff: false, ...config, roles });
  const players = roles.map((_, seat) => ({ id: `p${seat}`, name: `Player ${seat}` }));
  const created = createGame(parsed, players, 42);
  created.state.players.forEach((player, seat) => {
    const role = roles[seat] as RoleId;
    player.role = role;
    player.side = ROLES[role].initialSide;
  });
  return created;
}

/** Id of the n-th player holding `role`. */
export function idOf(state: GameState, role: RoleId, nth = 0): PlayerId {
  const player = state.players.filter((p) => p.role === role)[nth];
  if (!player) throw new Error(`No player with role ${role}`);
  return player.id;
}

export function act(state: GameState, actor: PlayerId, action: GameAction): GameState {
  const result = applyAction(state, actor, action);
  if (!result.ok) throw new Error(`${actor} ${action.type}: ${result.error.message}`);
  return result.state;
}

/** Advances the phase, collecting events into `log` when given. */
export function advance(state: GameState, log?: GameEvent[]): GameState {
  const result = advancePhase(state);
  log?.push(...result.events);
  return result.state;
}

const matches = (phase: Phase, target: Partial<Record<string, string>>): boolean =>
  Object.entries(target).every(([key, value]) => (phase as Record<string, unknown>)[key] === value);

/** Advances (resolving with defaults) until the phase matches, e.g. `{ kind: "night", step: "witch" }`. */
export function advanceTo(
  state: GameState,
  target: { kind: Phase["kind"]; step?: string },
  log?: GameEvent[],
  limit = 50,
): GameState {
  let current = state;
  for (let i = 0; i < limit; i++) {
    if (matches(current.phase, target)) return current;
    if (current.phase.kind === "ended") break;
    current = advance(current, log);
  }
  expect.fail(`Never reached ${JSON.stringify(target)}; stuck at ${JSON.stringify(current.phase)}`);
}

export const alive = (state: GameState, id: PlayerId): boolean =>
  state.players.find((player) => player.id === id)?.alive ?? false;

/** Every living player votes for `target` (they cannot vote for themselves, so `target` abstains). */
export function everyoneVotes(state: GameState, target: PlayerId | null): GameState {
  let current = state;
  for (const player of current.players.filter((p) => p.alive)) {
    current = act(current, player.id, {
      type: "vote",
      target: player.id === target ? null : target,
    });
  }
  return current;
}

/** Like `advanceTo`, but always advances at least once (next occurrence of the phase). */
export const advanceToNext = (
  state: GameState,
  target: { kind: Phase["kind"]; step?: string },
  log?: GameEvent[],
): GameState => advanceTo(advance(state, log), target, log);
