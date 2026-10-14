import {
  type DeckIssue,
  deckIssues,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type RevealOnDeath,
  ROLE_IDS,
  ROLES,
  type RoleId,
  type RoomStart,
  recommendedDeck,
  revealOnDeathSchema,
  type Timers,
  type VoteTieRule,
  voteTieRuleSchema,
} from "@howlsinthedark/shared";

export const PACES = ["fast", "normal", "slow"] as const;
export type Pace = (typeof PACES)[number];

/** Timer presets; `normal` matches the server defaults. */
export const PACE_TIMERS: Record<Pace, Timers> = {
  fast: {
    nightStepSeconds: 20,
    debateSeconds: 120,
    voteSeconds: 45,
    sheriffElectionSeconds: 60,
    reactionSeconds: 20,
  },
  normal: {
    nightStepSeconds: 30,
    debateSeconds: 180,
    voteSeconds: 60,
    sheriffElectionSeconds: 90,
    reactionSeconds: 30,
  },
  slow: {
    nightStepSeconds: 45,
    debateSeconds: 300,
    voteSeconds: 90,
    sheriffElectionSeconds: 120,
    reactionSeconds: 45,
  },
};

export type RoleCounts = Partial<Record<RoleId, number>>;

/** What the host chooses before starting. Kept on the host's device and sent with `room:start`. */
export interface LobbySettings {
  /** `recommended` follows the table size; `custom` uses `counts`. */
  deck: "recommended" | "custom";
  counts: RoleCounts;
  pace: Pace;
  sheriff: boolean;
  revealOnDeath: RevealOnDeath;
  voteTieRule: VoteTieRule;
}

export const defaultSettings = (players: number): LobbySettings => ({
  deck: "recommended",
  counts: countsOf(recommendedDeck(clampPlayers(players))),
  pace: "normal",
  sheriff: true,
  revealOnDeath: "role",
  voteTieRule: "runoff",
});

const clampPlayers = (players: number) => Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, players));

export function countsOf(deck: readonly RoleId[]): RoleCounts {
  const counts: RoleCounts = {};
  for (const role of deck) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

/** The deck as a list of cards, in the order of `ROLE_IDS`. */
export function deckFor(settings: LobbySettings, players: number): RoleId[] {
  if (settings.deck === "recommended") return recommendedDeck(clampPlayers(players));
  return ROLE_IDS.flatMap((role) => Array.from({ length: settings.counts[role] ?? 0 }, () => role));
}

/** Changes how many copies of a role the custom deck has, within the card's limits. */
export function setCount(counts: RoleCounts, role: RoleId, count: number): RoleCounts {
  const max = Math.min(ROLES[role].maxCopies, MAX_PLAYERS);
  const next = Math.max(0, Math.min(max, Math.round(count)));
  const { [role]: _, ...rest } = counts;
  return next === 0 ? rest : { ...rest, [role]: next };
}

export type StartProblem =
  | { kind: "notEnoughPlayers"; players: number; min: number }
  | { kind: "deckSize"; cards: number; players: number }
  | DeckIssue;

/** Why the game cannot start yet (empty: ready). The server checks all of this again. */
export function startProblems(settings: LobbySettings, players: number): StartProblem[] {
  if (players < MIN_PLAYERS) return [{ kind: "notEnoughPlayers", players, min: MIN_PLAYERS }];
  const deck = deckFor(settings, players);
  const problems: StartProblem[] = [];
  if (deck.length !== players) problems.push({ kind: "deckSize", cards: deck.length, players });
  problems.push(...deckIssues(deck));
  return problems;
}

/** The `room:start` payload. A recommended deck is left to the server (same deck, fewer bytes). */
export function toRoomStart(settings: LobbySettings, players: number): RoomStart {
  return {
    ...(settings.deck === "custom" ? { roles: deckFor(settings, players) } : {}),
    sheriff: settings.sheriff,
    revealOnDeath: settings.revealOnDeath,
    voteTieRule: settings.voteTieRule,
    timers: PACE_TIMERS[settings.pace],
  };
}

/**
 * Restores the host's last settings (saved as JSON on their device). Anything unknown or out
 * of range falls back to the default, so a stale or edited value can never break the lobby.
 */
export function parseSettings(raw: string | null, players: number): LobbySettings {
  const fallback = defaultSettings(players);
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return fallback;
  }
  if (typeof data !== "object" || data === null) return fallback;
  const value = data as Record<string, unknown>;
  const pick = <T>(key: string, allowed: readonly T[], otherwise: T): T =>
    allowed.includes(value[key] as T) ? (value[key] as T) : otherwise;

  let counts: RoleCounts = {};
  if (typeof value.counts === "object" && value.counts !== null) {
    for (const [role, count] of Object.entries(value.counts)) {
      if ((ROLE_IDS as readonly string[]).includes(role) && typeof count === "number") {
        counts = setCount(counts, role as RoleId, count);
      }
    }
  }
  return {
    deck: pick("deck", ["recommended", "custom"] as const, fallback.deck),
    counts: Object.keys(counts).length ? counts : fallback.counts,
    pace: pick("pace", PACES, fallback.pace),
    sheriff: typeof value.sheriff === "boolean" ? value.sheriff : fallback.sheriff,
    revealOnDeath: pick("revealOnDeath", revealOnDeathSchema.options, fallback.revealOnDeath),
    voteTieRule: pick("voteTieRule", voteTieRuleSchema.options, fallback.voteTieRule),
  };
}
