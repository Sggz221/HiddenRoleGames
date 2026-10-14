export interface AttemptLimiterOptions {
  /** Failures allowed inside the window before the key is blocked. */
  maxFailures: number;
  windowMs: number;
}

/**
 * Sliding-window limiter for failed join attempts (someone guessing room codes).
 * Only failures count, so honest players are never slowed down.
 */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly options: AttemptLimiterOptions,
    private readonly now: () => number,
  ) {}

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.options.maxFailures;
  }

  recordFailure(key: string): void {
    this.failures.set(key, [...this.recent(key), this.now()]);
  }

  /** Drops expired entries so the map cannot grow forever. */
  prune(): void {
    for (const key of [...this.failures.keys()]) this.recent(key);
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.options.windowMs;
    const recent = (this.failures.get(key) ?? []).filter((time) => time > cutoff);
    if (recent.length) this.failures.set(key, recent);
    else this.failures.delete(key);
    return recent;
  }
}
