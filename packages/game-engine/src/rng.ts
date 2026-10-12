/**
 * Deterministic PRNG (mulberry32). Its whole state is a single uint32 stored inside the
 * GameState, so games stay serializable and replays/tests are reproducible.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Mutable cursor over the RNG state, used inside a single engine operation on a draft. */
export class RngCursor {
  constructor(public state: number) {}

  float(): number {
    const [value, next] = nextRandom(this.state);
    this.state = next;
    return value;
  }

  /** Integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.float() * max);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("Cannot pick from an empty list");
    return items[this.int(items.length)] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  }
}

/** Normalizes any number into a valid uint32 seed. */
export const toSeed = (seed: number): number => seed >>> 0;
