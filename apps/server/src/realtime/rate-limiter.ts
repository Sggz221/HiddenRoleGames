export interface TokenBucketOptions {
  /** Messages allowed in a burst. */
  capacity: number;
  /** Tokens recovered per second. */
  refillPerSecond: number;
}

/** Classic token bucket: allows short bursts and a sustained `refillPerSecond` rate. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly options: TokenBucketOptions,
    private readonly now: () => number,
  ) {
    this.tokens = options.capacity;
    this.updatedAt = now();
  }

  /** Spends a token; `false` when the caller is over the limit. */
  take(): boolean {
    const now = this.now();
    const elapsedSeconds = Math.max(0, now - this.updatedAt) / 1000;
    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    this.updatedAt = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
