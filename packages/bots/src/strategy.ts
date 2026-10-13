import type { GameAction, PlayerId, PlayerView } from "@aullidos/shared";

/** Small seeded PRNG (mulberry32) so a bot's choices are reproducible. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const pick = <T>(rng: Rng, items: readonly T[]): T | undefined =>
  items[Math.floor(rng() * items.length)];

/** `count` distinct items (fewer if there are not enough). */
function pickMany<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length) {
    const [item] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (item !== undefined) picked.push(item);
  }
  return picked;
}

/**
 * A plausible, always-valid action for the viewer's `pending` options, or `null` when there is
 * nothing to do. Wolves avoid voting for their allies so games tend to finish; everything else
 * is random. Only uses what the server sent (`view.pending`), like a real client.
 */
export function chooseAction(view: PlayerView, rng: Rng): GameAction | null {
  const { pending } = view;
  if (!pending) return null;
  const canSkip = pending.types.includes("skip");
  const type = pending.types.find((candidate) => candidate !== "skip");
  const skip: GameAction | null = canSkip ? { type: "skip" } : null;
  if (!type) return skip;

  const allies = new Set(view.players.filter((p) => p.isWolfAlly).map((p) => p.id));
  const inPack = view.you.side === "wolves" && view.you.alive;
  const preferred = inPack ? pending.targets.filter((id) => !allies.has(id)) : [];
  const targets = preferred.length ? preferred : pending.targets;
  const target: PlayerId | undefined = pick(rng, targets);

  switch (type) {
    case "vote":
      return { type, target: target ?? null };
    case "wolfHoundChoose":
      return { type, side: rng() < 0.5 ? "village" : "wolves" };
    case "infect":
      return { type, infect: rng() < 0.5 };
    case "witch": {
      const potions = view.you.witchPotions;
      const heal =
        potions?.heal && rng() < 0.5 ? (pick(rng, view.nightVictims ?? []) ?? null) : null;
      const poison = potions?.poison && rng() < 0.3 ? (target ?? null) : null;
      return { type, heal, poison };
    }
    case "cupidLink": {
      const [a, b] = pickMany(rng, pending.targets, 2);
      return a && b ? { type, targets: [a, b] } : skip;
    }
    case "piperCharm": {
      const charmed = pickMany(rng, pending.targets, 2);
      return charmed.length ? { type, targets: charmed } : skip;
    }
    case "sheriffTieBreak":
      return { type, target: target ?? null };
    case "seerInspect":
    case "wildChildModel":
    case "salvadorProtect":
    case "wolfVote":
    case "bigBadWolfKill":
    case "whiteWolfKill":
    case "foxSniff":
    case "hunterShoot":
    case "sheriffSuccessor":
      return target ? { type, target } : skip;
  }
}
