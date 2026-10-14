/**
 * Balance simulation for the loner roles (Piper, White Werewolf). Plays thousands of games with
 * the real engine and naive players, and reports, per table size, how often each team wins and
 * on which day. Used to set `minPlayers` in `packages/shared/src/game/roles.ts` (ADR 0006).
 *
 *   pnpm --filter @howlsinthedark/game-engine balance [games-per-size] [from-to]   (e.g. 1000 5-14)
 *
 * Players are deliberately naive (random legal choices; the pack never targets its allies),
 * so the numbers compare roles against each other rather than predict real games.
 */
import {
  type GameAction,
  type GameResult,
  gameConfigSchema,
  type PlayerView,
  type RoleId,
  recommendedDeck,
  type WinnerTeam,
} from "@howlsinthedark/shared";
import {
  advancePhase,
  applyAction,
  createGame,
  type GameState,
  projectFor,
} from "../dist/index.js";

const print = (line: string) => process.stdout.write(`${line}\n`);

const GAMES = Number(process.argv[2] ?? 2000);
const SIZES = (process.argv[3] ?? "5-20").split("-").map(Number) as [number, number];
const sizes = Array.from({ length: SIZES[1] - SIZES[0] + 1 }, (_, i) => i + SIZES[0]);

/** mulberry32: small seeded PRNG so runs are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(view: PlayerView, random: () => number): GameAction | null {
  const { pending } = view;
  if (!pending) return null;
  const pick = <T>(items: readonly T[]): T | undefined =>
    items[Math.floor(random() * items.length)];
  const allies = new Set(view.players.filter((p) => p.isWolfAlly).map((p) => p.id));
  const inPack = view.you.side === "wolves";
  const preferred = inPack ? pending.targets.filter((id) => !allies.has(id)) : pending.targets;
  const target = pick(preferred.length ? preferred : pending.targets);
  const two = [...pending.targets].sort(() => random() - 0.5).slice(0, 2);
  const type = pending.types.find((t) => t !== "skip");
  switch (type) {
    case undefined:
      return null;
    case "vote":
      return { type, target: target ?? null };
    case "cupidLink":
      return two.length === 2 ? { type, targets: [two[0] ?? "", two[1] ?? ""] } : null;
    case "piperCharm":
      return two.length ? { type, targets: two } : null;
    case "wolfHoundChoose":
      return { type, side: random() < 0.5 ? "village" : "wolves" };
    case "infect":
      return { type, infect: random() < 0.5 };
    case "witch": {
      const heal =
        view.you.witchPotions?.heal && random() < 0.5
          ? (pick(view.nightVictims ?? []) ?? null)
          : null;
      const poison = view.you.witchPotions?.poison && random() < 0.2 ? (target ?? null) : null;
      return { type, heal, poison };
    }
    case "whiteWolfKill":
      // The White Werewolf betrays the pack whenever he can.
      return target ? { type, target } : null;
    case "sheriffTieBreak":
      return { type, target: target ?? null };
    default:
      return target ? ({ type, target } as GameAction) : null;
  }
}

function play(roles: RoleId[], seed: number): { result: GameResult; day: number } {
  const random = rng(seed);
  const config = gameConfigSchema.parse({ roles, sheriff: true });
  const players = roles.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
  let state: GameState = createGame(config, players, seed).state;
  for (let steps = 0; steps < 2000 && !state.result; steps++) {
    for (const player of state.players) {
      const action = choose(projectFor(state, player.id), random);
      if (!action) continue;
      const applied = applyAction(state, player.id, action);
      if (applied.ok) state = applied.state;
    }
    state = advancePhase(state).state;
  }
  return { result: state.result ?? { team: "none", winners: [] }, day: state.day };
}

/** The recommended deck with one villager (or the last special card) swapped for `role`. */
function withRole(players: number, role: RoleId, replacing: RoleId): RoleId[] {
  const deck = recommendedDeck(players);
  const index = deck.lastIndexOf(replacing);
  deck[index === -1 ? deck.length - 1 : index] = role;
  return deck;
}

interface Stats {
  wins: Map<WinnerTeam, { games: number; days: number }>;
  games: number;
}

function simulate(deck: RoleId[]): Stats {
  const stats: Stats = { wins: new Map(), games: 0 };
  for (let seed = 1; seed <= GAMES; seed++) {
    const { result, day } = play(deck, seed * 7919);
    const entry = stats.wins.get(result.team) ?? { games: 0, days: 0 };
    entry.games += 1;
    entry.days += day;
    stats.wins.set(result.team, entry);
    stats.games += 1;
  }
  return stats;
}

const pct = (stats: Stats, team: WinnerTeam) =>
  `${(((stats.wins.get(team)?.games ?? 0) / stats.games) * 100).toFixed(0)}%`;
const avgDay = (stats: Stats, teams: WinnerTeam[]) => {
  const rows = teams.map((team) => stats.wins.get(team) ?? { games: 0, days: 0 });
  const games = rows.reduce((sum, row) => sum + row.games, 0);
  return games ? (rows.reduce((sum, row) => sum + row.days, 0) / games).toFixed(1) : "-";
};

for (const [role, replacing, team] of [
  ["piper", "villager", "piper"],
  ["white-werewolf", "villager", "white-werewolf"],
] as const) {
  print(`\n## ${role} (${GAMES} partidas por tamaño)\n`);
  print("| Jugadores | Solitario | Su día medio | Aldea | Día | Lobos | Día |");
  print("|---|---|---|---|---|---|---|");
  for (const players of sizes) {
    const stats = simulate(withRole(players, role, replacing));
    const cell = (t: WinnerTeam) => `${pct(stats, t)} | ${avgDay(stats, [t])}`;
    print(`| ${players} | ${cell(team)} | ${cell("village")} | ${cell("wolves")} |`);
  }
}
