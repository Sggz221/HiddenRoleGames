import {
  type GameAction,
  type GameEvent,
  gameConfigSchema,
  NARRATION_KEYS,
  type PlayerView,
  ROLE_IDS,
  type RoleId,
  validateDeck,
} from "@howlsinthedark/shared";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyAction } from "./actions.js";
import { advancePhase, canAdvanceEarly } from "./advance.js";
import { createGame } from "./create.js";
import { narrate } from "./narration.js";
import { RngCursor } from "./rng.js";
import type { GameState } from "./state.js";
import { eventsFor, projectFor } from "./view.js";

const SPECIALS = ROLE_IDS.filter((role) => !["villager", "werewolf", "sister"].includes(role));

/** Random but valid deck: ~1/4 wolves, a random subset of special roles, villagers to fill. */
const deckArb = fc
  .record({
    players: fc.integer({ min: 5, max: 14 }),
    specials: fc.shuffledSubarray(SPECIALS),
    sisters: fc.boolean(),
  })
  .map(({ players, specials, sisters }) => {
    const deck: RoleId[] = Array.from(
      { length: Math.max(1, Math.floor(players / 4)) },
      () => "werewolf",
    );
    if (sisters && deck.length + 2 <= players) deck.push("sister", "sister");
    for (const role of specials) if (deck.length < players) deck.push(role);
    while (deck.length < players) deck.push("villager");
    return deck;
  })
  .filter((deck) => validateDeck(deck).length === 0);

const gameArb = fc.record({
  deck: deckArb,
  seed: fc.integer({ min: 0, max: 2 ** 31 }),
  botSeed: fc.integer({ min: 0, max: 2 ** 31 }),
  sheriff: fc.boolean(),
  voteTieRule: fc.constantFrom("runoff", "no-elimination", "sheriff"),
});

/** A bot picks a random legal action from its own view (exactly what a client would see). */
function botAction(view: PlayerView, rng: RngCursor): GameAction | null {
  const pending = view.pending;
  if (!pending || rng.float() < 0.15) return null;
  const type = rng.pick(pending.types);
  const targets = pending.targets;
  const target = () => rng.pick(targets);
  const two = () => rng.shuffle(targets).slice(0, 2);

  const skip = (): GameAction | null => (pending.types.includes("skip") ? { type: "skip" } : null);
  if (
    targets.length === 0 &&
    !["skip", "infect", "wolfHoundChoose", "witch", "vote"].includes(type)
  ) {
    return skip();
  }
  switch (type) {
    case "vote":
      return { type, target: targets.length && rng.float() < 0.9 ? target() : null };
    case "cupidLink": {
      const [a, b] = two();
      return a && b ? { type, targets: [a, b] } : skip();
    }
    case "piperCharm":
      return { type, targets: two() };
    case "wolfHoundChoose":
      return { type, side: rng.float() < 0.5 ? "wolves" : "village" };
    case "infect":
      return { type, infect: rng.float() < 0.5 };
    case "witch": {
      const heal =
        view.you.witchPotions?.heal && targets.length && rng.float() < 0.3 ? target() : null;
      const poisoned =
        view.you.witchPotions?.poison && targets.length && rng.float() < 0.3 ? target() : null;
      const poison = poisoned === heal ? null : poisoned;
      return { type, heal, poison };
    }
    case "sheriffTieBreak":
      return { type, target: target() };
    case "skip":
      return { type };
    default:
      return { type, target: target() } as GameAction;
  }
}

/** Asserts nothing secret about living players leaks into a living player's view. */
function assertNoLeaks(state: GameState, view: PlayerView): void {
  const viewer = state.players.find((p) => p.id === view.you.id);
  if (!viewer?.alive || state.phase.kind === "ended") return;
  const inPack = viewer.side === "wolves";
  const inspected = new Set(state.seerResults.map((r) => r.target));

  for (const player of view.players) {
    if (player.id === viewer.id || !player.alive) continue;
    if (player.role !== undefined) {
      const allowed =
        (viewer.role === "sister" && player.role === "sister") ||
        (viewer.role === "seer" && inspected.has(player.id));
      expect(allowed, `${viewer.role} sees ${player.id}'s role`).toBe(true);
    }
    if (player.side !== undefined) expect.fail(`${viewer.role} sees a living player's side`);
    if (player.isWolfAlly !== undefined) expect(inPack).toBe(true);
    if (player.charmed !== undefined) {
      expect(viewer.role === "piper" || state.charmed.includes(viewer.id)).toBe(true);
    }
  }
  if (view.wolfVotes) expect(inPack).toBe(true);
  // Ballots are secret while the vote is open: the living only see their own.
  if (viewer.alive) expect(Object.keys(view.votes).every((id) => id === viewer.id)).toBe(true);
}

function assertEventsPrivate(state: GameState, viewerId: string, events: GameEvent[]): void {
  const viewer = state.players.find((p) => p.id === viewerId);
  if (!viewer?.alive) return;
  for (const event of eventsFor(state, viewerId, events)) {
    if (event.type === "roleAssigned")
      expect(event.audience).toEqual({ kind: "players", ids: [viewerId] });
    if (event.type === "wolfVoteCast" || event.type === "wolvesChoseVictim") {
      expect(viewer.side, "only the pack hears the wolves").toBe("wolves");
    }
    if (event.type === "seerResult") expect(viewer.role).toBe("seer");
  }
}

const KNOWN_KEYS: ReadonlySet<string> = new Set(NARRATION_KEYS);

/** The narrator only names roles a living player may know: their own, the seer's visions, the dead. */
function assertNarrationPrivate(state: GameState, viewerId: string, events: GameEvent[]): void {
  const lines = narrate(state, eventsFor(state, viewerId, events), viewerId);
  const viewer = state.players.find((p) => p.id === viewerId);
  // Plain checks: calling `expect` for every line makes this test several times slower.
  for (const line of lines) {
    if (!KNOWN_KEYS.has(line.key)) expect.fail(`Unknown narration key ${line.key}`);
    // Witness lines are for those who see everything (the dead), never for the living.
    if (viewer?.alive && state.phase.kind !== "ended" && line.key.startsWith("witness.")) {
      expect.fail(`a living ${viewer.role} hears ${line.key}`);
    }
    if (!viewer?.alive || state.phase.kind === "ended" || line.params.role === undefined) continue;
    const allowed =
      line.key === "game.yourRole" ||
      line.key.startsWith("death.") ||
      (line.key === "private.seerResult" && viewer.role === "seer");
    if (!allowed) expect.fail(`${viewer.role} hears a role in ${line.key}`);
  }
}

describe("random games with bots", () => {
  it("always end with a valid result and never leak secrets", () => {
    fc.assert(
      fc.property(gameArb, ({ deck, seed, botSeed, sheriff, voteTieRule }) => {
        const config = gameConfigSchema.parse({ roles: deck, sheriff, voteTieRule, maxDays: 30 });
        const players = deck.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
        const rng = new RngCursor(botSeed);
        let { state, events } = createGame(config, players, seed);
        const checkNarration = () => {
          for (const player of state.players) assertNarrationPrivate(state, player.id, events);
        };
        checkNarration();

        for (let tick = 0; tick < 3000 && state.phase.kind !== "ended"; tick++) {
          for (const player of state.players) {
            assertEventsPrivate(state, player.id, events);
            const view = projectFor(state, player.id);
            assertNoLeaks(state, view);
            const action = botAction(view, rng);
            if (!action) continue;
            const result = applyAction(state, player.id, action);
            expect(result.ok, `${player.id} ${JSON.stringify(action)} rejected`).toBe(true);
            if (result.ok) state = result.state;
          }
          if (state.phase.kind !== "night" && !canAdvanceEarly(state) && rng.float() < 0.3)
            continue;
          ({ state, events } = advancePhase(state));
          checkNarration();
        }

        expect(state.phase.kind).toBe("ended");
        const result = state.result;
        expect(result).not.toBeNull();
        const ids = new Set(state.players.map((p) => p.id));
        for (const winner of result?.winners ?? []) expect(ids.has(winner)).toBe(true);
      }),
      { numRuns: 300 },
    );
    // 300 whole games: well over the default 5 s on slower CI runners.
  }, 30_000);
});
