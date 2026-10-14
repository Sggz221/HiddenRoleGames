import { describe, expect, it } from "vitest";
import { TokenBucket } from "./rate-limiter.js";

describe("TokenBucket", () => {
  it("allows a burst, then refills at the configured rate", () => {
    let now = 0;
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 0.5 }, () => now);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    now += 1_999;
    expect(bucket.take()).toBe(false);
    now += 1;
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });

  it("never stores more than its capacity", () => {
    let now = 0;
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 10 }, () => now);
    now += 60_000;
    expect([bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, false]);
  });

  it("ignores clocks that go backwards", () => {
    let now = 10_000;
    const bucket = new TokenBucket({ capacity: 1, refillPerSecond: 1 }, () => now);
    bucket.take();
    now -= 5_000;
    expect(bucket.take()).toBe(false);
  });
});
