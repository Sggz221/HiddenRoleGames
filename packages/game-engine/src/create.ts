import { type GameConfig, type GameEvent, ROLES, validateDeck } from "@aullidos/shared";
import { startDay, startNight } from "./advance.js";
import { RngCursor, toSeed } from "./rng.js";
import { ALL, Draft, emptyNight, type GameState, to } from "./state.js";

export interface NewPlayer {
  id: string;
  name: string;
}

/**
 * Deals the deck and opens the first phase. `players` order is the seating order.
 * Pass a `config` already parsed with `gameConfigSchema` (defaults applied).
 */
export function createGame(
  config: GameConfig,
  players: readonly NewPlayer[],
  seed: number,
): { state: GameState; events: GameEvent[] } {
  if (players.length !== config.roles.length) {
    throw new RangeError(`Deck has ${config.roles.length} cards for ${players.length} players`);
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new Error("Player ids must be unique");
  }
  const deckIssues = validateDeck(config.roles);
  if (deckIssues.length) throw new Error(`Invalid deck: ${deckIssues.join("; ")}`);

  const rng = new RngCursor(toSeed(seed));
  const deck = rng.shuffle(config.roles);

  const state: GameState = {
    version: 1,
    config,
    players: players.map((player, seat) => {
      const role = deck[seat] ?? "villager";
      return {
        id: player.id,
        name: player.name,
        seat,
        role,
        side: ROLES[role].initialSide,
        alive: true,
        infected: false,
      };
    }),
    rngState: rng.state,
    day: 0,
    phase: { kind: "ended" },
    sheriff: null,
    sheriffElectionHeld: false,
    lovers: null,
    charmed: [],
    wildChildModel: null,
    wolfHoundSide: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    infectUsed: false,
    foxActive: true,
    elderLivesLost: 0,
    villagePowersLost: false,
    wolfHasDied: false,
    rustVictim: null,
    seerResults: [],
    foxResults: [],
    night: emptyNight(),
    votes: {},
    runoffCandidates: [],
    decisions: [],
    resume: null,
    result: null,
  };

  const draft = new Draft(state);
  draft.emit({ type: "gameStarted", players: state.players.map((p) => p.id) }, ALL);
  for (const player of draft.state.players) {
    draft.emit({ type: "roleAssigned", role: player.role }, to(player.id));
  }

  // With the Angel in play, the village debates and votes before the first night.
  if (config.roles.includes("angel")) startDay(draft);
  else startNight(draft);

  return draft.finish();
}
