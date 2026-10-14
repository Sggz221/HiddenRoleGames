import type {
  Audience,
  Decision,
  GameConfig,
  GameEvent,
  GameEventPayload,
  GameResult,
  Phase,
  PlayerId,
  RoleId,
  Side,
} from "@howlsinthedark/shared";
import { VILLAGE_POWER_ROLES } from "@howlsinthedark/shared";
import { RngCursor } from "./rng.js";

export interface PlayerState {
  id: PlayerId;
  name: string;
  seat: number;
  /** The card dealt. Never changes (infection changes `side`, not the card). */
  role: RoleId;
  side: Side;
  alive: boolean;
  infected: boolean;
}

/** Inputs collected during the current night; resolved at each step's end or at dawn. */
export interface NightInputs {
  cupid: [PlayerId, PlayerId] | null;
  seerTarget: PlayerId | null;
  wildChildModel: PlayerId | null;
  wolfHoundSide: Side | null;
  salvadorTarget: PlayerId | null;
  wolfVotes: Record<PlayerId, PlayerId>;
  wolvesVictim: PlayerId | null;
  /** `null` until the Infected Father answers. */
  infect: boolean | null;
  bigBadWolfVictim: PlayerId | null;
  whiteWolfVictim: PlayerId | null;
  witchHeal: PlayerId | null;
  witchPoison: PlayerId | null;
  foxTarget: PlayerId | null;
  piperTargets: PlayerId[];
}

export type DeathCause =
  | "wolves"
  | "big-bad-wolf"
  | "white-werewolf"
  | "poison"
  | "vote"
  | "hunter"
  | "grief"
  | "rust";

/** Complete, secret game state. JSON-serializable; never sent to clients (see `projectFor`). */
export interface GameState {
  version: 1;
  config: GameConfig;
  /** Seat order: index = seat. "Left" of a player is the next seat (clockwise). */
  players: PlayerState[];
  rngState: number;
  /** Night N is followed by day N. Day 0 only exists when the Angel is in the deck. */
  day: number;
  phase: Phase;
  sheriff: PlayerId | null;
  sheriffElectionHeld: boolean;
  lovers: [PlayerId, PlayerId] | null;
  charmed: PlayerId[];
  wildChildModel: PlayerId | null;
  wolfHoundSide: Side | null;
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  infectUsed: boolean;
  foxActive: boolean;
  /** Player the Salvador protected last night; he cannot protect them two nights in a row. */
  salvadorLast: PlayerId | null;
  elderLivesLost: number;
  villagePowersLost: boolean;
  /** True once any member of the wolf pack has died (disables the Big Bad Wolf). */
  wolfHasDied: boolean;
  /** Wolf poisoned by the Knight's rusty sword; dies at the next dawn. */
  rustVictim: PlayerId | null;
  seerResults: { target: PlayerId; role: RoleId }[];
  foxResults: { target: PlayerId; wolfNearby: boolean }[];
  night: NightInputs;
  /**
   * Votes of the current day step (sheriff election, vote or runoff). In the debate an entry
   * (always `null`) means the player is ready to go to the vote.
   */
  votes: Record<PlayerId, PlayerId | null>;
  runoffCandidates: PlayerId[];
  /** Interrupting decisions; the head one is the current `reaction` phase. */
  decisions: Decision[];
  /** Choice recorded for the current reaction phase (`undefined` = not decided yet). */
  decisionChoice?: PlayerId | null;
  /** Where the flow continues once all decisions are resolved. */
  resume: "night" | "day" | null;
  result: GameResult | null;
}

export const emptyNight = (): NightInputs => ({
  cupid: null,
  seerTarget: null,
  wildChildModel: null,
  wolfHoundSide: null,
  salvadorTarget: null,
  wolfVotes: {},
  wolvesVictim: null,
  infect: null,
  bigBadWolfVictim: null,
  whiteWolfVictim: null,
  witchHeal: null,
  witchPoison: null,
  foxTarget: null,
  piperTargets: [],
});

/**
 * Working copy for one engine operation. Mutations happen on a deep clone, so every public
 * engine function is pure from the caller's point of view.
 */
export class Draft {
  readonly state: GameState;
  readonly events: GameEvent[] = [];
  readonly rng: RngCursor;

  constructor(source: GameState) {
    this.state = JSON.parse(JSON.stringify(source)) as GameState;
    this.rng = new RngCursor(this.state.rngState);
  }

  finish(): { state: GameState; events: GameEvent[] } {
    this.state.rngState = this.rng.state;
    return { state: this.state, events: this.events };
  }

  emit(payload: GameEventPayload, audience: Audience = ALL): void {
    this.events.push({ ...payload, audience });
  }

  player(id: PlayerId): PlayerState {
    const player = findPlayer(this.state, id);
    if (!player) throw new Error(`Unknown player ${id}`);
    return player;
  }
}

export const ALL: Audience = { kind: "all" };
export const to = (...ids: PlayerId[]): Audience => ({ kind: "players", ids: [...new Set(ids)] });

export const findPlayer = (state: GameState, id: PlayerId): PlayerState | undefined =>
  state.players.find((player) => player.id === id);

export const alivePlayers = (state: GameState): PlayerState[] =>
  state.players.filter((player) => player.alive);

export const isAlive = (state: GameState, id: PlayerId | null | undefined): boolean =>
  id != null && findPlayer(state, id)?.alive === true;

/** Living members of the wolf pack (wolves, infected, transformed Wild Child, wolf-side Wolf Hound). */
export const wolfPack = (state: GameState): PlayerState[] =>
  alivePlayers(state).filter((player) => player.side === "wolves");

export const deckHas = (state: GameState, role: RoleId): boolean =>
  state.config.roles.includes(role);

export const firstAliveWithRole = (state: GameState, role: RoleId): PlayerState | undefined =>
  alivePlayers(state).find((player) => player.role === role);

/** Whether a living player can use their role's power right now. */
export function hasPower(state: GameState, player: PlayerState): boolean {
  if (!player.alive) return false;
  if (state.villagePowersLost && VILLAGE_POWER_ROLES.includes(player.role)) return false;
  return true;
}

/** Nearest living neighbours of a seat, walking left (+1) and right (-1) around the table. */
export function livingNeighbours(state: GameState, id: PlayerId): PlayerState[] {
  const count = state.players.length;
  const seat = state.players.findIndex((player) => player.id === id);
  const found: PlayerState[] = [];
  for (const direction of [1, -1]) {
    for (let step = 1; step < count; step++) {
      const candidate = state.players[(seat + direction * step + count * step) % count];
      if (candidate?.alive && candidate.id !== id) {
        if (!found.some((player) => player.id === candidate.id)) found.push(candidate);
        break;
      }
    }
  }
  return found;
}

export const loverOf = (state: GameState, id: PlayerId): PlayerId | null => {
  if (!state.lovers) return null;
  const [a, b] = state.lovers;
  if (a === id) return b;
  if (b === id) return a;
  return null;
};
